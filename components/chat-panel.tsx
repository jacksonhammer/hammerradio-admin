'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, orderBy, limit,
  onSnapshot, addDoc, serverTimestamp, deleteDoc,
  doc, getDoc, updateDoc, deleteField, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button }     from '@/components/ui/button';
import { Input }      from '@/components/ui/input';
import { Badge }      from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const CHAT_COL      = 'chatMessages';
const MAX_MSGS      = 80;
const HAMMER_AVATAR = '/hammer-logo.png';
const GIPHY_KEY     = '7J1K0IUqnOdJIU5LGEyu2HcoqLv1vrtP';
const ADMIN_USER_ID = 'admin_hammer';

const EMOJI_LIST = [
  '😀','😂','😍','🥰','😎','🤩','😜','🤔','😮','😢',
  '😡','🥳','🤯','😴','🤗','👍','👎','❤️','🔥','💯',
  '🎉','✨','💪','🙏','👏','🤣','😭','😱','🤤','😏',
  '💀','👀','🫡','🤝','✌️','🫶','💔','⭐','🎵','🎤',
  '📻','🎸','🥁','🎺','🎻','🎹','🎧','🎼','🔊','📡',
];

interface GifItem {
  id: string; title: string;
  url: string; previewUrl: string;
}

interface ReplyTo {
  id: string; nickname: string; text: string;
}

interface ChatMsg {
  id:            string;
  type?:         string;
  text?:         string;
  nickname?:     string;
  userId?:       string;
  source?:       string;
  isAdmin?:      boolean;
  gifUrl?:       string;
  imageUrl?:     string;
  audioUrl?:     string;
  audioDuration?: number;
  reactions?:    Record<string, Record<string, any>>;
  replyTo?:      ReplyTo;
  ts?:           any;
  edited?:       boolean;
}

/* ── helpers ──────────────────────────────────────────────────────── */
function formatTime(ts: any) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
}

function keyToEmoji(key: string): string {
  const LEGACY: Record<string, string> = {
    heart: '❤️', laugh: '😂', wow: '😮',
    sad: '😢', thumbsup: '👍', fire: '🔥',
  };
  if (LEGACY[key]) return LEGACY[key];
  try {
    return key.split('-').map(cp => String.fromCodePoint(parseInt(cp, 16))).join('');
  } catch { return key; }
}

function emojiToKey(emoji: string): string {
  return [...emoji].map(c => c.codePointAt(0)!.toString(16)).join('-');
}

function getReactionSummary(reactions?: Record<string, Record<string, any>>) {
  if (!reactions) return [];
  return Object.entries(reactions)
    .map(([key, users]) => ({
      key,
      emoji: keyToEmoji(key),
      count: Object.keys(users).length,
      iMine: !!(users[ADMIN_USER_ID]),
    }))
    .filter(r => r.count > 0);
}

async function toggleReaction(messageId: string, emoji: string) {
  const key = emojiToKey(emoji);
  try {
    const ref  = doc(db, CHAT_COL, messageId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const reactions     = snap.data().reactions || {};
    const emojiReactors = reactions[key] || {};
    const update: Record<string, any> = {};
    if (emojiReactors[ADMIN_USER_ID]) {
      update[`reactions.${key}.${ADMIN_USER_ID}`] = deleteField();
    } else {
      update[`reactions.${key}.${ADMIN_USER_ID}`] = 'Hammer';
    }
    await updateDoc(ref, update);
  } catch (e: any) {
    console.error('[AdminChat] reaction error:', e.message);
  }
}

/* ── GIF Picker Modal ─────────────────────────────────────────────── */
function GifPickerModal({
  open, onClose, onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (gif: GifItem) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs,    setGifs]    = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGifs = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q.trim()
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=24&rating=pg`;
      const res  = await fetch(url);
      const data = await res.json();
      setGifs((data.data || []).map((g: any) => ({
        id:         g.id,
        title:      g.title || '',
        url:        g.images.fixed_width.url,
        previewUrl: g.images.fixed_width_small?.url || g.images.fixed_width.url,
      })));
    } catch (e) {
      console.error('[GifPicker]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) { setSearchQuery(''); fetchGifs(''); }
  }, [open, fetchGifs]);

  function handleSearch(val: string) {
    setSearchQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchGifs(val), 500);
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-lg w-full p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-white text-sm">Send a GIF as Hammer</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-3">
          <Input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search GIFs…"
            className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 text-sm"
            autoFocus
          />
        </div>
        <div className="px-4 pb-2 h-[360px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">Loading…</div>
          ) : gifs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">No GIFs found</div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {gifs.map(gif => (
                <button
                  key={gif.id}
                  onClick={() => { onSelect(gif); onClose(); }}
                  className="aspect-square overflow-hidden rounded hover:ring-2 hover:ring-orange-500 transition-all"
                >
                  <img src={gif.previewUrl} alt={gif.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-700 text-center">
          <span className="text-xs text-gray-500">Powered by GIPHY</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Message Bubble ───────────────────────────────────────────────── */
function MessageBubble({
  msg, onDelete, onReply, onEdit,
}: {
  msg: ChatMsg;
  onDelete: (id: string) => void;
  onReply: (msg: ChatMsg) => void;
  onEdit: (id: string, newText: string) => void;
}) {
  const [showEmojis,  setShowEmojis]  = useState(false);
  const [isEditing,   setIsEditing]   = useState(false);
  const [editDraft,   setEditDraft]   = useState('');
  const [editSaving,  setEditSaving]  = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const type      = msg.type || 'text';
  const isAdmin   = msg.isAdmin || false;
  const nickname  = msg.nickname || (isAdmin ? 'Hammer' : 'Listener');
  const reactions = getReactionSummary(msg.reactions);
  const isTextMsg = type === 'text' || (!msg.gifUrl && !msg.imageUrl && !msg.audioUrl);

  const startEdit = () => {
    setEditDraft(msg.text || '');
    setIsEditing(true);
    setShowEmojis(false);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEdit = async () => {
    const trimmed = editDraft.trim();
    if (!trimmed || trimmed === msg.text) { setIsEditing(false); return; }
    setEditSaving(true);
    await onEdit(msg.id, trimmed);
    setEditSaving(false);
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditDraft('');
  };

  return (
    <div className={`flex gap-2 px-3 py-1.5 group hover:bg-white/5 rounded relative ${isAdmin ? 'bg-orange-500/5' : ''}`}>
      {/* Avatar */}
      {isAdmin ? (
        <img src={HAMMER_AVATAR} alt="Hammer"
          className="w-7 h-7 rounded-full mt-0.5 flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center text-xs text-gray-400">
          {nickname.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <span className="text-xs font-bold text-orange-400">{nickname}</span>
          {isAdmin && (
            <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold tracking-wide">
              HOST
            </span>
          )}
          {msg.source === 'groupme' && (
            <span className="text-[9px] bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded font-semibold">
              GroupMe
            </span>
          )}
          {msg.edited && (
            <span className="text-[9px] text-gray-500 italic">edited</span>
          )}
          <span className="text-[10px] text-gray-500 ml-auto">{formatTime(msg.ts)}</span>
        </div>

        {/* Reply quote */}
        {msg.replyTo && (
          <div className="border-l-2 border-orange-500 pl-2 mb-1.5 bg-white/5 rounded-sm py-1 pr-2">
            <p className="text-xs text-orange-400 font-semibold">{msg.replyTo.nickname}</p>
            <p className="text-xs text-gray-400 truncate">{msg.replyTo.text}</p>
          </div>
        )}

        {/* Content */}
        {type === 'gif' && msg.gifUrl && (
          <img src={msg.gifUrl} alt="GIF"
            className="rounded-lg max-w-[200px] max-h-[160px] object-cover mt-1" />
        )}
        {type === 'image' && msg.imageUrl && (
          <img src={msg.imageUrl} alt="Attachment"
            className="rounded-lg max-w-[200px] max-h-[200px] object-cover mt-1" />
        )}
        {type === 'audio' && msg.audioUrl && (
          <div className="flex items-center gap-2 mt-1">
            <audio controls src={msg.audioUrl} className="h-8 max-w-[220px]" />
            {msg.audioDuration && (
              <span className="text-xs text-gray-500">{msg.audioDuration}s</span>
            )}
          </div>
        )}

        {/* Text content — normal or edit mode */}
        {isTextMsg && (
          isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                ref={editInputRef}
                value={editDraft}
                onChange={e => setEditDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                maxLength={280}
                className="flex-1 bg-gray-700 border border-orange-500/50 rounded px-2 py-1 text-sm text-white focus:outline-none"
              />
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="text-xs text-green-400 hover:text-green-300 font-semibold px-1 disabled:opacity-50"
              >
                {editSaving ? '…' : '✓'}
              </button>
              <button
                onClick={cancelEdit}
                className="text-xs text-gray-500 hover:text-white px-1"
              >
                ✕
              </button>
            </div>
          ) : (
            msg.text && (
              <p className="text-sm text-gray-100 leading-snug break-words">{msg.text}</p>
            )
          )
        )}

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {reactions.map(r => (
              <button
                key={r.key}
                onClick={() => toggleReaction(msg.id, r.emoji)}
                className={`flex items-center gap-1 text-xs rounded-full px-2 py-0.5 transition-colors
                  ${r.iMine
                    ? 'bg-orange-500/25 border border-orange-500/40'
                    : 'bg-white/8 hover:bg-white/15'}`}
              >
                {r.emoji}
                <span className="text-gray-400">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Emoji picker */}
        {showEmojis && (
          <div className="mt-2 p-2 bg-gray-800 rounded-lg border border-gray-700 w-fit max-w-[260px]">
            <div className="flex flex-wrap gap-1">
              {EMOJI_LIST.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => { toggleReaction(msg.id, emoji); setShowEmojis(false); }}
                  className="text-xl w-9 h-9 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons on hover */}
      {!isEditing && (
        <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 mt-0.5 transition-opacity flex-shrink-0">
          <button
            onClick={() => setShowEmojis(v => !v)}
            className="text-gray-500 hover:text-yellow-400 text-sm px-1 transition-colors"
            title="React"
          >
            😊
          </button>
          <button
            onClick={() => { onReply(msg); setShowEmojis(false); }}
            className="text-gray-500 hover:text-blue-400 text-xs px-1 transition-colors"
            title="Reply"
          >
            ↩
          </button>
          {isAdmin && isTextMsg && (
            <button
              onClick={startEdit}
              className="text-gray-500 hover:text-orange-400 text-xs px-1 transition-colors"
              title="Edit"
            >
              ✏️
            </button>
          )}
          <button
            onClick={() => onDelete(msg.id)}
            className="text-gray-600 hover:text-red-400 text-xs px-1 transition-colors"
            title="Delete"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Panel ───────────────────────────────────────────────────── */
export default function ChatPanel() {
  const [messages,  setMessages]  = useState<ChatMsg[]>([]);
  const [text,      setText]      = useState('');
  const [sending,   setSending]   = useState(false);
  const [gifOpen,   setGifOpen]   = useState(false);
  const [replyTo,   setReplyTo]   = useState<ReplyTo | null>(null);
  const bottomRef      = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(true);

  /* Subscribe to messages */
  useEffect(() => {
    const q = query(
      collection(db, CHAT_COL),
      orderBy('ts', 'desc'),
      limit(MAX_MSGS)
    );
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ChatMsg))
        .sort((a, b) => {
          const aTime = a.ts?.toMillis?.() ?? Date.now();
          const bTime = b.ts?.toMillis?.() ?? Date.now();
          return aTime - bTime;
        });
      setMessages(msgs);
    });
    return unsub;
  }, []);

  /* Auto-scroll only when near bottom */
  useEffect(() => {
    if (shouldScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  /* Delete all messages */
  const handleDeleteAll = async () => {
    if (!confirm('Delete ALL messages? This cannot be undone.')) return;
    try {
      const batch = writeBatch(db);
      messages.forEach(msg => batch.delete(doc(db, CHAT_COL, msg.id)));
      await batch.commit();
    } catch (e: any) {
      console.error('[AdminChat] delete all error:', e.message);
    }
  };

  /* Send text as Hammer */
  const handleSend = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText('');
    const currentReply = replyTo;
    setReplyTo(null);
    shouldScrollRef.current = true;
    try {
      const payload: Record<string, any> = {
        type: 'text', text: msg,
        nickname: 'Hammer', userId: ADMIN_USER_ID,
        source: 'host', isAdmin: true,
        ts: serverTimestamp(),
      };
      if (currentReply) payload.replyTo = currentReply;
      await addDoc(collection(db, CHAT_COL), payload);
    } catch (e: any) {
      console.error('[AdminChat] send error:', e.message);
    } finally {
      setSending(false);
    }
  };

  /* Send GIF as Hammer */
  const handleGifSelect = async (gif: GifItem) => {
    shouldScrollRef.current = true;
    try {
      await addDoc(collection(db, CHAT_COL), {
        type: 'gif', gifUrl: gif.url, text: gif.title || '',
        nickname: 'Hammer', userId: ADMIN_USER_ID,
        source: 'host', isAdmin: true,
        ts: serverTimestamp(),
      });
    } catch (e: any) {
      console.error('[AdminChat] gif error:', e.message);
    }
  };

  /* Edit a message */
  const handleEdit = async (id: string, newText: string) => {
    try {
      await updateDoc(doc(db, CHAT_COL, id), {
        text: newText,
        edited: true,
        editedAt: serverTimestamp(),
      });
    } catch (e: any) {
      console.error('[AdminChat] edit error:', e.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') setReplyTo(null);
  };

  const handleDelete = async (id: string) => {
    try { await deleteDoc(doc(db, CHAT_COL, id)); }
    catch (e: any) { console.error('[AdminChat] delete error:', e.message); }
  };

  const handleReply = (msg: ChatMsg) => {
    setReplyTo({
      id:       msg.id,
      nickname: msg.nickname || 'Listener',
      text:     msg.text || (msg.type === 'gif' ? '🎞 GIF' : msg.type === 'audio' ? '🎤 Voice message' : '…'),
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Live Chat</span>
          <Badge variant="secondary" className="text-xs">{messages.length}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeleteAll}
            className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
          >
            Delete All
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea
        className="flex-1 py-2"
        onScrollCapture={(e) => {
          const el = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
          if (el) {
            shouldScrollRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;
          }
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
            No messages yet
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onDelete={handleDelete}
              onReply={handleReply}
              onEdit={handleEdit}
            />
          ))
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="mx-3 mb-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-orange-400 font-semibold">↩ Replying to {replyTo.nickname}</p>
            <p className="text-xs text-gray-400 truncate">{replyTo.text}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="text-gray-500 hover:text-white text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Send bar */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <img src={HAMMER_AVATAR} alt="Hammer" className="w-5 h-5 rounded-full" />
          <span className="text-xs text-orange-400 font-semibold">Sending as Hammer</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGifOpen(true)}
            className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 px-3 text-xs font-bold"
          >
            GIF
          </Button>
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? `Reply to ${replyTo.nickname}…` : 'Message your listeners…'}
            className="flex-1 bg-gray-800/60 border-white/10 text-white placeholder:text-gray-500 text-sm"
            disabled={sending}
            maxLength={280}
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            size="sm"
            className="bg-orange-600 hover:bg-orange-500 text-white px-4"
          >
            {sending ? '…' : 'Send'}
          </Button>
        </div>
      </div>

      {/* GIF Picker Modal */}
      <GifPickerModal
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onSelect={handleGifSelect}
      />
    </div>
  );
}