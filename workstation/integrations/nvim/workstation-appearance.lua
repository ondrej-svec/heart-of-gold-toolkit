-- Opt-in fallback for missed/stale terminal appearance notifications (Neovim 0.11+).
-- Ask the rendering terminal; leave parsing and manual overrides to nvim.tty.
local key = 'workstation-terminal-appearance'
local previous = package.loaded[key]
if previous then previous.stop() end
local M = {}
local timer, group
local suspended = false

local function native_tui()
  -- --embed stdout may carry MessagePack: never send escape bytes into that pipe.
  if vim.uv.guess_handle(1) ~= 'tty' then return false end
  for _, ui in ipairs(vim.api.nvim_list_uis()) do
    if ui.chan == 1 and ui.stdout_tty then return true end
  end
  return false
end

function M.stop()
  if timer then timer:stop(); timer:close(); timer = nil end
  if group then vim.api.nvim_del_augroup_by_id(group); group = nil end
end

local function refresh()
  if suspended or not native_tui() then return end
  local ok = pcall(function()
    assert(io.stdout:write('\027]11;?\007'))
    assert(io.stdout:flush())
  end)
  if not ok then M.stop() end
end

function M.setup()
  M.stop()
  if not native_tui() then return false end
  suspended = false
  group = vim.api.nvim_create_augroup('WorkstationTerminalAppearance', { clear = true })
  timer = assert(vim.uv.new_timer())
  local owned = timer
  local function request()
    -- An old timer callback may already be queued when setup/stop runs.
    if timer == owned then refresh() end
  end
  timer:start(1000, 1000, vim.schedule_wrap(request))
  vim.api.nvim_create_autocmd('FocusGained', { group = group, callback = request })
  vim.api.nvim_create_autocmd('VimSuspend', {
    group = group, callback = function() suspended = true end,
  })
  vim.api.nvim_create_autocmd('VimResume', {
    group = group, callback = function() suspended = false; request() end,
  })
  vim.api.nvim_create_autocmd('VimLeavePre', { group = group, callback = M.stop })
  request()
  return timer ~= nil
end

package.loaded[key] = M
return M
