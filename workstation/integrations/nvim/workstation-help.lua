-- Opt-in, command-only offline reference. No source-buffer text leaves Neovim.
local M = {}
local current, config, definition, group
local generation = 0
local LIMIT = 2 * 1024 * 1024
local function notice(message) vim.notify('WorkstationHelp: ' .. message, vim.log.levels.WARN) end
local function quiet(fn)
  local old = vim.o.eventignore
  vim.o.eventignore = 'all'
  local ok, result = pcall(fn)
  vim.o.eventignore = old
  if not ok then error(result) end
  return result
end
local function dispose(request)
  if not request or request.closed then return end
  request.closed = true -- Invalidate before kill, window close or async callbacks.
  if current == request then current = nil end
  if request.job then pcall(request.job.kill, request.job, 9); request.job = nil end
  quiet(function()
    if request.window and vim.api.nvim_win_is_valid(request.window)
      and request.buffers[vim.api.nvim_win_get_buf(request.window)] then
      pcall(vim.api.nvim_win_close, request.window, true)
    end
    for buffer in pairs(request.buffers) do
      if vim.api.nvim_buf_is_valid(buffer) then pcall(vim.api.nvim_buf_delete, buffer, { force = true }) end
    end
  end)
end
local function live(request)
  return current == request and not request.closed
end
local function source_ready(request)
  return live(request) and vim.api.nvim_win_is_valid(request.source_window)
    and vim.api.nvim_buf_is_valid(request.source_buffer)
    and vim.api.nvim_win_get_buf(request.source_window) == request.source_buffer
    and vim.api.nvim_get_current_win() == request.source_window
end
local function valid_id(id)
  return type(id) == 'string' and #id <= 80 and id ~= 'index'
    and id:match('^[a-z][a-z0-9.%-]*$') and not id:find('[.%-][.%-]') and not id:find('[.%-]$')
end
local function valid_text(text)
  return type(text) == 'string' and #text > 0 and #text <= 65536
    and not text:find('[%z\1-\8\11\12\14-\31\127]')
end
local function validate(data)
  assert(type(data) == 'table' and data.schemaVersion == 1 and data.ok == true)
  assert(type(data.cards) == 'table' and vim.islist(data.cards) and #data.cards <= 200)
  assert(type(data.documents) == 'table' and data.documents ~= vim.NIL and valid_text(data.indexMarkdown))
  local count, seen = 0, {}
  for id, text in pairs(data.documents) do
    assert(valid_id(id) and valid_text(text)); count = count + 1
  end
  assert(count > 0 and count <= 200)
  for _, card in ipairs(data.cards) do
    assert(type(card) == 'table' and valid_id(card.id) and not seen[card.id])
    assert(valid_text(card.title) and #card.title <= 200 and not card.title:find('\n'))
    assert(data.documents[card.id] == card.markdown)
    seen[card.id] = true
  end
  -- Only known sibling Markdown targets become in-memory links.
  local documents = vim.tbl_extend('error', data.documents, { index = data.indexMarkdown })
  for _, text in pairs(documents) do
    for target in text:gmatch('%]%(([^)]+)%)') do
      if target:match('%.md$') then
        local id = target:match('^([a-z][a-z0-9.%-]*)%.md$')
        assert(id and documents[id])
      end
    end
  end
  return documents
end
local function display(request, data, documents, selected)
  if not live(request) then return end
  if not selected then dispose(request); return end
  if not source_ready(request) then dispose(request); notice('Source window changed; run the command again.'); return end
  local offered = false
  for _, card in ipairs(data.cards) do if card == selected then offered = true end end
  if not offered then dispose(request); notice('Invalid selection.'); return end
  local ok = pcall(function()
    quiet(function()
      local prefix = 'workstation-guide://' .. tostring(vim.uv.hrtime()) .. '/' .. request.generation .. '/'
      local by_id = {}
      for id, text in pairs(documents) do
        local buffer = vim.api.nvim_create_buf(false, true)
        request.buffers[buffer] = true; by_id[id] = buffer
        local body = text:gsub('%]%(([a-z][a-z0-9.%-]*)%.md%)', function(target)
          return '](' .. prefix .. target .. '.md)'
        end)
        vim.api.nvim_buf_set_name(buffer, prefix .. id .. '.md')
        local bo = vim.bo[buffer]
        bo.buftype = 'nofile'; bo.bufhidden = 'hide'; bo.buflisted = false
        bo.swapfile = false; bo.undofile = false; bo.modeline = false
        vim.api.nvim_buf_set_lines(buffer, 0, -1, false, vim.split(body, '\n', { plain = true }))
        bo.filetype = 'markdown'; bo.modified = false; bo.readonly = true; bo.modifiable = false
      end
      request.window = vim.api.nvim_open_win(by_id[selected.id], true,
        { split = 'right', win = request.source_window, noautocmd = true })
      vim.wo[request.window].wrap = true; vim.wo[request.window].linebreak = true
    end)
  end)
  if not ok then dispose(request); notice('Could not open the guide split.'); end
end
local function environment()
  local env = {}
  for key, value in pairs(vim.fn.environ()) do
    if key == 'HOME' or key == 'PATH' or key == 'XDG_CONFIG_HOME' or key == 'LANG'
      or key == 'TERM' or key == 'LC_ALL' or key:match('^LC_[A-Z_]+$') then env[key] = value end
  end
  return env
end
local function open(query)
  local window, buffer = vim.api.nvim_get_current_win(), vim.api.nvim_get_current_buf()
  if current and current.buffers[buffer] then window, buffer = current.source_window, current.source_buffer end
  dispose(current)
  generation = generation + 1
  local request = { generation = generation, source_window = window, source_buffer = buffer, buffers = {} }
  current = request
  if not source_ready(request) then dispose(request); notice('Return to a source window first.'); return end
  local args = { config.node, config.entry, '--json' }
  if config.profile then vim.list_extend(args, { '--profile', config.profile }) end
  if query == '' then table.insert(args, 'list') else vim.list_extend(args, { '--', query }) end
  local chunks, size, failed = {}, 0, false
  local ok, job = pcall(vim.system, args, {
    env = environment(), clear_env = true, cwd = vim.fn.fnamemodify(config.entry, ':h'),
    stdin = '', timeout = 10000,
    stdout = function(err, chunk)
      if not live(request) then return end
      if err then failed = true end
      if chunk and not failed then
        size = size + #chunk
        if size > LIMIT then failed = true else table.insert(chunks, chunk) end
      end
      if failed and request.job then pcall(request.job.kill, request.job, 9) end
    end,
    stderr = function() end, -- Never echo private child diagnostics or accumulate them.
  }, vim.schedule_wrap(function(result)
    request.job = nil
    if not live(request) then return end
    if failed or result.code ~= 0 or result.signal ~= 0 then
      dispose(request); notice('Offline lookup failed or exceeded its limit.'); return
    end
    local decoded, data, documents
    decoded = pcall(function() data = vim.json.decode(table.concat(chunks)); documents = validate(data) end)
    chunks = {}
    if not decoded then dispose(request); notice('Invalid offline guide response.'); return end
    if not source_ready(request) then dispose(request); notice('Source window changed; run the command again.'); return end
    if #data.cards == 0 then dispose(request); notice('No matching guides. Try a task or omit the query.'); return end
    -- An exact stable ID is direct even when related-card prose also matches it.
    for _, card in ipairs(data.cards) do
      if card.id == query then display(request, data, documents, card); return end
    end
    if #data.cards == 1 then display(request, data, documents, data.cards[1]); return end
    local selected = pcall(vim.ui.select, data.cards, {
      prompt = 'Workstation — read a guide:', format_item = function(card) return card.title .. ' (' .. card.id .. ')' end,
    }, function(card) display(request, data, documents, card) end)
    if not selected then dispose(request); notice('Guide selection failed.'); end
  end))
  if ok then request.job = job else dispose(request); notice('Could not start the offline guide.'); end
end
local function absolute(path)
  return type(path) == 'string' and path:sub(1, 1) == '/' and not path:find('[%z\1-\31\127]')
end
function M.setup(options)
  if vim.fn.has('nvim-0.11') ~= 1 or type(vim.system) ~= 'function' then notice('Neovim 0.11+ is required.'); return false end
  if type(options) ~= 'table' or not absolute(options.node) or not absolute(options.entry)
    or vim.fn.executable(options.node) ~= 1 or vim.fn.filereadable(options.entry) ~= 1
    or options.profile ~= nil and not absolute(options.profile) then
    notice('Provide an absolute Node executable, guide entry and optional profile path.'); return false
  end
  local existing = vim.api.nvim_get_commands({ builtin = false }).WorkstationHelp
  if existing and existing.definition ~= definition then notice('Command already exists; nothing replaced.'); return false end
  for _, buffer in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_get_commands(buffer, {}).WorkstationHelp then notice('Buffer-local command already exists; nothing replaced.'); return false end
  end
  dispose(current)
  config = { node = options.node, entry = options.entry, profile = options.profile }
  if not existing then
    vim.api.nvim_create_user_command('WorkstationHelp', function(command)
      if command.bang then dispose(current) else open(command.args) end
    end, { nargs = '*', bang = true, desc = 'Read offline workstation guides; bang cancels/closes', force = false })
    definition = vim.api.nvim_get_commands({ builtin = false }).WorkstationHelp.definition
  end
  if not group then
    group = vim.api.nvim_create_augroup('WorkstationGuideHelp', { clear = false })
    vim.api.nvim_create_autocmd('WinClosed', { group = group, callback = function(event)
      if current and (tonumber(event.match) == current.window or tonumber(event.match) == current.source_window) then dispose(current) end
    end })
    vim.api.nvim_create_autocmd('BufWipeout', { group = group, callback = function(event)
      if current and (current.buffers[event.buf] or current.source_buffer == event.buf) then dispose(current) end
    end })
    vim.api.nvim_create_autocmd('VimLeavePre', { group = group, callback = function() dispose(current) end })
  end
  return true
end
return M
