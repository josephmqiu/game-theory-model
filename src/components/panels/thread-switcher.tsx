import { useCallback, useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThreadStore } from "@/stores/thread-store";
import type { ThreadState } from "../../../shared/types/workspace-state";

function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return "";
  const delta = Date.now() - timestamp;
  const seconds = Math.floor(delta / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function statusDotClass(
  status: ThreadState["latestTerminalStatus"],
): string | null {
  switch (status) {
    case "completed":
      return "bg-emerald-500";
    case "failed":
      return "bg-red-500";
    case "cancelled":
      return "bg-amber-500";
    default:
      return null;
  }
}

function ThreadRow({
  thread,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  thread: ThreadState;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(thread.title);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== thread.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, thread.title, onRename]);

  const dot = statusDotClass(thread.latestTerminalStatus);
  const relTime = formatRelativeTime(
    thread.latestActivityAt ?? thread.updatedAt,
  );

  if (isConfirmingDelete) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]">
        <span className="min-w-0 flex-1 truncate text-zinc-400">Delete?</span>
        <button
          className="text-red-400 hover:text-red-300 text-[12px] font-medium"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
            setIsConfirmingDelete(false);
          }}
        >
          Delete
        </button>
        <button
          className="text-zinc-500 hover:text-zinc-300 text-[12px]"
          onClick={(e) => {
            e.stopPropagation();
            setIsConfirmingDelete(false);
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer",
        isActive ? "bg-zinc-800" : "hover:bg-zinc-800/60",
      )}
      onClick={isRenaming ? undefined : onSelect}
      onKeyDown={
        isRenaming
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
      }
      role="option"
      aria-selected={isActive}
      tabIndex={0}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)}
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        {isRenaming ? (
          <input
            ref={inputRef}
            className="w-full rounded bg-zinc-700 px-1 py-0 text-[13px] text-zinc-200 outline-none focus:ring-1 focus:ring-zinc-500"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setRenameValue(thread.title);
                setIsRenaming(false);
              }
            }}
            onBlur={commitRename}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex items-center gap-1">
            <span className="truncate text-[13px] text-zinc-200">
              {thread.title}
            </span>
            {thread.isPrimary && (
              <span className="shrink-0 text-[10px] text-zinc-500">
                Primary
              </span>
            )}
          </div>
        )}
      </div>

      {!isRenaming && (
        <>
          <span className="shrink-0 text-[11px] text-zinc-500 group-hover:hidden">
            {relTime}
          </span>
          <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
            <button
              className="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
              onClick={(e) => {
                e.stopPropagation();
                setRenameValue(thread.title);
                setIsRenaming(true);
              }}
              title="Rename"
            >
              <Pencil size={13} />
            </button>
            {!thread.isPrimary && (
              <button
                className="rounded p-0.5 text-zinc-500 hover:bg-zinc-700 hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmingDelete(true);
                }}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ThreadSwitcher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  const threads = useThreadStore((s) => s.threads);
  const activeThreadId = useThreadStore((s) => s.activeThreadId);
  const isCreating = useThreadStore((s) => s.isCreating);
  const selectThread = useThreadStore((s) => s.selectThread);
  const createThread = useThreadStore((s) => s.createThread);
  const renameThread = useThreadStore((s) => s.renameThread);
  const deleteThread = useThreadStore((s) => s.deleteThread);

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const displayTitle = activeThread?.title ?? "No Thread";

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            className="flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 py-0.5 text-left hover:bg-zinc-800"
            title={displayTitle}
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-300">
              {displayTitle}
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "shrink-0 text-zinc-500 transition-transform",
                open && "rotate-180",
              )}
            />
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={4}
            className="z-50 min-w-[220px] max-w-[320px] rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Threads
            </div>

            <div className="max-h-[300px] overflow-y-auto">
              {threads.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onSelect={() => {
                    void selectThread(thread.id);
                    setOpen(false);
                  }}
                  onRename={(title) => void renameThread(thread.id, title)}
                  onDelete={() => {
                    void deleteThread(thread.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <button
        className="shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
        onClick={() => void createThread()}
        disabled={isCreating}
        title="New thread"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
