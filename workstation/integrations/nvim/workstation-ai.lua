-- Opt-in writing commands. No mappings, automatic send, replacement or save.
local M = {}
local current, config, definition, group, command_scope
local jobs = {}
local serial = 0
local LIMIT = 2 * 1024 * 1024
local names = { 'WorkstationAI', 'WorkstationAISend', 'WorkstationAIApply', 'WorkstationAICancel' }
local function notice(s) vim.notify('WorkstationAI: ' .. s, vim.log.levels.WARN) end
local function quiet(fn)
  local old = vim.o.eventignore; vim.o.eventignore = 'all'
  local ok, value = pcall(fn); vim.o.eventignore = old
  if not ok then error(value) end
  return value
end
local function timer_close(timer)
  if timer and not timer:is_closing() then timer:stop(); timer:close() end
end
local function stop(job)
  if not job or job.finished or job.cancelled then return end
  job.cancelled = true
  if job.handle then pcall(job.handle.kill, job.handle, 15) end
  -- Let Node forward cancellation and reap Pi's separate process group first.
  job.escalation = vim.defer_fn(function()
    if not job.finished and job.handle then pcall(job.handle.kill, job.handle, 9) end
  end, 2000)
end
local function dispose(r)
  if not r or r.closed then return end
  r.closed = true; if current == r then current = nil end
  stop(r.job)
  quiet(function()
    if r.window and vim.api.nvim_win_is_valid(r.window) and vim.api.nvim_win_get_buf(r.window) == r.buffer then
      pcall(vim.api.nvim_win_close, r.window, true)
    end
    if r.buffer and vim.api.nvim_buf_is_valid(r.buffer) then pcall(vim.api.nvim_buf_delete, r.buffer, { force = true }) end
  end)
end
local function live(r) return current == r and not r.closed end
local function source_exists(r)
  return vim.api.nvim_buf_is_valid(r.source) and vim.api.nvim_win_is_valid(r.sourcewin)
    and vim.api.nvim_win_get_buf(r.sourcewin) == r.source
end
local function unchanged(r)
  return source_exists(r) and vim.api.nvim_buf_get_changedtick(r.source) == r.tick
end
local function owned_here(r)
  return live(r) and r.buffer and vim.api.nvim_get_current_buf() == r.buffer
end
local function text(s, limit)
  return type(s) == 'string' and #s > 0 and #s <= limit and not s:find('[%z\1-\8\11\12\14-\31\127]')
end
local function hex(s, length) return type(s) == 'string' and #s == length and s:match('^[a-f0-9]+$') end
local function action(a)
  return type(a) == 'table' and text(a.id, 80) and a.id:match('^[a-z][a-z%-]+$')
    and text(a.title, 200) and not a.title:find('\n')
    and (a.disposition == 'review-rewrite' or a.disposition == 'scratch')
    and type(a.prompt) == 'table' and hex(a.prompt.sha256, 64) and hex(a.prompt.revision, 40)
end
local function valid_preview(data, r)
  return action(data.action) and vim.deep_equal(data.action, r.action) and hex(data.fingerprint, 64)
    and data.provider == 'openai-codex' and text(data.model, 120) and data.model:match('^[a-z0-9._%-]+$')
    and vim.tbl_contains({ 'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max' }, data.thinking)
    and data.piVersion == '0.85.1' and text(data.notice, 8000)
end
local function environment()
  local env = {}
  for _, key in ipairs({ 'HOME', 'PATH', 'XDG_CONFIG_HOME', 'PI_CODING_AGENT_DIR', 'LANG', 'LC_ALL', 'LC_CTYPE',
    'LC_MESSAGES', 'TZ', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy',
    'all_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR',
    -- Keep routing overrides visible to Node's fail-closed resolver, never hide them.
    'PI_PACKAGE_DIR', 'OPENAI_BASE_URL', 'OPENAI_API_BASE', 'OPENAI_CODEX_BASE_URL' }) do
    if vim.env[key] ~= nil then env[key] = vim.env[key] end
  end
  return env
end
local function paint(r, lines)
  assert(live(r))
  quiet(function()
    if not r.buffer then
      r.buffer = vim.api.nvim_create_buf(false, true)
      vim.api.nvim_buf_set_name(r.buffer, 'workstation-ai://' .. tostring(vim.uv.hrtime()) .. '/' .. r.serial .. '/review.md')
      local bo = vim.bo[r.buffer]
      bo.buftype = 'nofile'; bo.bufhidden = 'hide'; bo.buflisted = false
      bo.swapfile = false; bo.undofile = false; bo.modeline = false; bo.undolevels = -1
      bo.filetype = 'markdown'
      r.window = vim.api.nvim_open_win(r.buffer, true, { split = 'right', win = r.sourcewin, noautocmd = true })
      vim.wo[r.window].wrap = true; vim.wo[r.window].linebreak = true
      vim.api.nvim_buf_create_user_command(r.buffer, 'WorkstationAICancel', function() dispose(r) end, {})
    end
    assert(vim.api.nvim_win_is_valid(r.window) and vim.api.nvim_win_get_buf(r.window) == r.buffer)
    vim.bo[r.buffer].modifiable = true; vim.bo[r.buffer].readonly = false
    vim.api.nvim_buf_set_lines(r.buffer, 0, -1, false, lines)
    vim.bo[r.buffer].modified = false; vim.bo[r.buffer].readonly = true; vim.bo[r.buffer].modifiable = false
  end)
end
local function failure(r)
  if not live(r) then return end
  notice('Writing could not complete safely. Nothing applied; check Pi/configuration separately and prepare again.')
  if r.buffer then
    r.phase = 'failed'
    local ok = pcall(paint, r, { '# Writing failed or cancelled', '', 'Nothing applied. Run :WorkstationAI again for a fresh preview.', '', ':q or :WorkstationAICancel closes this view.' })
    if not ok then dispose(r) end
  else dispose(r) end
end
local function invoke(r, words, input, done)
  local args = { config.node, config.entry, '--json' }
  if config.profile then vim.list_extend(args, { '--profile', config.profile }) end
  vim.list_extend(args, { 'ai' }); vim.list_extend(args, words)
  local job = { chunks = {}, size = 0 }; r.job = job; jobs[job] = true
  local ok, handle = pcall(vim.system, args, {
    env = environment(), clear_env = true, cwd = vim.fn.fnamemodify(config.entry, ':h'), stdin = input,
    stdout = function(err, chunk)
      if job.finished or job.cancelled then return end
      if err then job.failed = true end
      if chunk and not job.failed then
        job.size = job.size + #chunk
        if job.size > LIMIT then job.failed = true else table.insert(job.chunks, chunk) end
      end
      if job.failed then vim.schedule(function() stop(job) end) end
    end,
    stderr = function() end, -- Never echo or accumulate private child diagnostics.
  }, vim.schedule_wrap(function(result)
    job.finished = true; jobs[job] = nil; timer_close(job.timer); timer_close(job.escalation)
    if r.job == job then r.job = nil end
    if not live(r) then job.chunks = {}; return end
    if job.failed or job.cancelled or result.code ~= 0 or result.signal ~= 0 then job.chunks = {}; failure(r); return end
    local good, data = pcall(vim.json.decode, table.concat(job.chunks)); job.chunks = {}
    if not good or type(data) ~= 'table' or data.schemaVersion ~= 1 or data.ok ~= true then failure(r); return end
    local handled = pcall(done, data)
    if not handled then failure(r) end
  end))
  if not ok then job.finished = true; jobs[job] = nil; r.job = nil; failure(r); return end
  job.handle = handle
  job.timer = vim.defer_fn(function() if not job.finished then job.failed = true; stop(job) end end,
    words[1] == 'run' and 185000 or 10000)
end
local function disclosure(r)
  local p = r.preview
  local lines = { '# ' .. r.action.title, '', ('Lines %d–%d · %d lines · %d UTF-8 bytes'):format(r.first, r.last, #r.original, #r.input),
    r.explicit and 'Explicit linewise range.' or 'Current paragraph only; never an implicit whole-buffer selection.',
    ('Provider: %s · Model: %s · Thinking: %s · Pi: %s'):format(p.provider, p.model, p.thinking, p.piVersion),
    'Prompt SHA-256: ' .. p.action.prompt.sha256, 'Fabric revision: ' .. p.action.prompt.revision,
    '', p.notice, '', '## Exact selected source', '' }
  if r.first == 1 and r.last == r.total then table.insert(lines, 5, 'This scope contains every line in this buffer.') end
  vim.list_extend(lines, r.original); return lines
end
local function apply(r)
  if not owned_here(r) or r.phase ~= 'review' or r.action.disposition ~= 'review-rewrite' then notice('Apply is not available.'); return end
  if not unchanged(r) then notice('Source changed; this stale result remains readable but cannot be applied.'); return end
  local bo = vim.bo[r.source]
  local undo = bo.undolevels == -123456 and vim.go.undolevels or bo.undolevels
  if bo.buftype ~= '' or not bo.modifiable or bo.readonly or undo < 1 then notice('Source must be writable with undo enabled. Nothing applied.'); return end
  local normalized = r.result:gsub('\r\n', '\n'):gsub('\n$', '')
  local replacement = vim.split(normalized, '\n', { plain = true })
  if vim.deep_equal(replacement, r.original) then notice('No textual change to apply.'); return end
  local ok = pcall(function()
    quiet(function()
      vim.api.nvim_set_current_win(r.sourcewin)
      assert(unchanged(r))
      -- Explicitly split, never undojoin with an earlier user edit.
      vim.cmd('let &l:undolevels = &l:undolevels')
      vim.api.nvim_buf_set_lines(r.source, r.first - 1, r.last, false, replacement)
      local line = math.min(r.cursor[1], vim.api.nvim_buf_line_count(r.source))
      local body = vim.api.nvim_buf_get_lines(r.source, line - 1, line, false)[1]
      vim.api.nvim_win_set_cursor(r.sourcewin, { line, math.min(r.cursor[2], #body) })
    end)
  end)
  if not ok then notice('Apply failed; inspect the source and undo history before continuing.'); return end
  r.phase = 'applied'
  local lines = { '# Applied to the unsaved source', '', 'One change. Use u in the source to undo. Apply cannot be repeated.', '', '## Reviewed proposal', '' }
  vim.list_extend(lines, vim.split(r.result, '\n', { plain = true })); paint(r, lines)
end
local function send(r)
  if not owned_here(r) or r.phase ~= 'preview' then notice('Prepare a fresh preview before sending.'); return end
  if not unchanged(r) then notice('Source changed; prepare again before sending.'); return end
  r.phase = 'running'
  local lines = disclosure(r); vim.list_extend(lines, { '', '## Writing in progress', '', 'No source edits. :q or :WorkstationAICancel cancels the owned job.' }); paint(r, lines)
  invoke(r, { 'run', r.action.id, '--send', '--expect', r.preview.fingerprint }, r.input, function(data)
    assert(valid_preview(data, r) and data.fingerprint == r.preview.fingerprint)
    assert(data.provider == r.preview.provider and data.model == r.preview.model and data.thinking == r.preview.thinking)
    assert(text(data.text, 131072) and data.text:find('%S'))
    if not source_exists(r) then dispose(r); return end
    r.result = data.text; r.phase = r.action.disposition == 'review-rewrite' and 'review' or 'scratch'
    local body = disclosure(r)
    vim.list_extend(body, { '', '## Result ready', '', r.phase == 'review'
      and 'Review the proposal below. :WorkstationAIApply makes one unsaved change; u in the source undoes it.'
      or 'Scratch feedback/summary only. No Apply command; the source is not a replacement target.', '', '## Result', '' })
    vim.list_extend(body, vim.split(data.text, '\n', { plain = true })); paint(r, body)
    if r.phase == 'review' then vim.api.nvim_buf_create_user_command(r.buffer, 'WorkstationAIApply', function() apply(r) end, {}) end
  end)
end
local function prepare(r, chosen)
  if not live(r) then return end
  if not chosen then dispose(r); return end
  local offered = false
  for _, a in ipairs(r.actions) do if chosen == a then offered = true end end
  if not offered or not unchanged(r) or vim.api.nvim_get_current_win() ~= r.sourcewin then dispose(r); notice('Selection or source changed; start again.'); return end
  r.action = chosen; r.phase = 'preparing'
  invoke(r, { 'prepare', chosen.id }, '', function(data)
    assert(valid_preview(data, r))
    if not unchanged(r) or vim.api.nvim_get_current_win() ~= r.sourcewin then dispose(r); notice('Source changed; start again.'); return end
    r.preview = data; r.phase = 'preview'
    local body = disclosure(r)
    vim.list_extend(body, { '', '## Nothing sent yet', '', 'Review the exact scope and settings above.', ':WorkstationAISend explicitly sends this text to the provider.', ':q or :WorkstationAICancel cancels without sending.' })
    paint(r, body)
    vim.api.nvim_buf_create_user_command(r.buffer, 'WorkstationAISend', function() send(r) end, {})
  end)
end
local function open(command)
  local scope = command_scope; command_scope = nil
  if command.range > 0 and scope and scope.unsupported_visual then
    notice('Character/block Visual selections are unsupported. Use V for whole lines, or an explicit numeric line range.'); return
  end
  if current and current.buffer == vim.api.nvim_get_current_buf() then dispose(current); notice('Return to the source, then start a new action.'); return end
  dispose(current)
  local source, sourcewin = vim.api.nvim_get_current_buf(), vim.api.nvim_get_current_win()
  if vim.bo[source].buftype ~= '' then notice('Select a normal text buffer.'); return end
  local all = vim.api.nvim_buf_get_lines(source, 0, -1, false)
  local cursor = vim.api.nvim_win_get_cursor(sourcewin)
  local first, last = command.line1, command.line2
  if command.range == 0 then
    first = cursor[1]; last = first
    if not all[first]:find('%S') then notice('Cursor is on a blank line; choose a paragraph or explicit line range.'); return end
    while first > 1 and all[first - 1]:find('%S') do first = first - 1 end
    while last < #all and all[last + 1]:find('%S') do last = last + 1 end
  end
  local original = {}; for i = first, last do table.insert(original, all[i]) end
  local input = table.concat(original, '\n')
  if not text(input, 131072) or not input:find('%S') then notice('Select nonempty text, at most 128 KiB, without control bytes.'); return end
  serial = serial + 1
  local r = { serial = serial, source = source, sourcewin = sourcewin, first = first, last = last,
    original = original, input = input, explicit = command.range > 0, total = #all, cursor = cursor,
    tick = vim.api.nvim_buf_get_changedtick(source), phase = 'choosing' }
  current = r
  invoke(r, { 'list' }, '', function(data)
    assert(type(data.actions) == 'table' and vim.islist(data.actions) and #data.actions > 0 and #data.actions <= 20)
    local seen = {}; for _, a in ipairs(data.actions) do assert(action(a) and not seen[a.id]); seen[a.id] = true end
    r.actions = data.actions
    if command.args ~= '' then
      for _, a in ipairs(r.actions) do if a.id == command.args then prepare(r, a); return end end
      dispose(r); notice('Unknown writing action. Omit the argument to choose.'); return
    end
    if not unchanged(r) or vim.api.nvim_get_current_win() ~= r.sourcewin then dispose(r); return end
    vim.ui.select(r.actions, { prompt = 'Workstation — choose writing action (nothing sent):',
      format_item = function(a) return a.title .. ' (' .. a.id .. ')' end }, function(a) prepare(r, a) end)
  end)
end
local function absolute(path) return type(path) == 'string' and path:sub(1, 1) == '/' and not path:find('[%z\1-\31\127]') end
function M.setup(options)
  if vim.fn.has('nvim-0.11') ~= 1 or type(vim.system) ~= 'function' then notice('Neovim 0.11+ is required.'); return false end
  if type(options) ~= 'table' or not absolute(options.node) or not absolute(options.entry)
    or vim.fn.executable(options.node) ~= 1 or vim.fn.filereadable(options.entry) ~= 1
    or options.profile ~= nil and not absolute(options.profile) then notice('Provide absolute Node, entry and optional profile paths.'); return false end
  local existing = vim.api.nvim_get_commands({ builtin = false })
  for _, name in ipairs(names) do
    if existing[name] and not (name == 'WorkstationAI' and existing[name].definition == definition) then notice('Command collision; nothing replaced.'); return false end
    for _, b in ipairs(vim.api.nvim_list_bufs()) do
      if (not current or current.buffer ~= b) and vim.api.nvim_buf_get_commands(b, {})[name] then notice('Buffer command collision; nothing replaced.'); return false end
    end
  end
  dispose(current); config = { node = options.node, entry = options.entry, profile = options.profile }
  if not existing.WorkstationAI then
    vim.api.nvim_create_user_command('WorkstationAI', function(command)
      if command.bang then dispose(current) else open(command) end
    end, { nargs = '?', range = true, bang = true, force = false, desc = 'Preview paragraph/range writing; bang cancels/closes' })
    definition = vim.api.nvim_get_commands({ builtin = false }).WorkstationAI.definition
  end
  if not group then
    group = vim.api.nvim_create_augroup('WorkstationGuideAI', { clear = false })
    -- User-command callbacks expose resolved lines, not the original range or
    -- Visual type. Capture only this transient command-line scope, not history.
    vim.api.nvim_create_autocmd('CmdlineLeave', { group = group, pattern = ':', callback = function()
      local typed = vim.fn.getcmdline()
      local scope = { unsupported_visual = not vim.v.event.abort and typed:find('WorkstationAI', 1, true)
        and (typed:find("'<", 1, true) or typed:find("'>", 1, true)) and vim.fn.visualmode() ~= 'V' }
      command_scope = scope
      vim.schedule(function() if command_scope == scope then command_scope = nil end end)
    end })
    vim.api.nvim_create_autocmd('WinClosed', { group = group, callback = function(event)
      if current and (tonumber(event.match) == current.window or tonumber(event.match) == current.sourcewin) then dispose(current) end
    end })
    vim.api.nvim_create_autocmd('BufWipeout', { group = group, callback = function(event)
      if current and (event.buf == current.buffer or event.buf == current.source) then dispose(current) end
    end })
    vim.api.nvim_create_autocmd('VimLeavePre', { group = group, callback = function()
      dispose(current)
      local pending = {}; for job in pairs(jobs) do table.insert(pending, job); stop(job) end
      for _, job in ipairs(pending) do if job.handle and not job.finished then pcall(job.handle.wait, job.handle, 2500) end end
    end })
  end
  return true
end
return M
