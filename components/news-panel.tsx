'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Newspaper, Plus, Trash2, Pin, ExternalLink } from 'lucide-react';

interface NewsArticle {
  id: string;
  headline: string;
  body?: string;
  type: 'news' | 'alert' | 'promo';
  pinned: boolean;
  link?: string;
  ts: number;
}

export function NewsPanel() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'news' | 'alert' | 'promo'>('news');
  const [pinned, setPinned] = useState(false);
  const [link, setLink] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('ts', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setArticles(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<NewsArticle, 'id'>) })));
    });
    return unsub;
  }, []);

  async function handlePublish() {
    if (!headline.trim()) return;
    setPublishing(true);
    await addDoc(collection(db, 'news'), {
      headline: headline.trim(),
      body: body.trim() || null,
      type,
      pinned,
      link: link.trim() || null,
      ts: Date.now(),
    });
    setHeadline('');
    setBody('');
    setLink('');
    setPinned(false);
    setPublishing(false);
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, 'news', id));
  }

  async function togglePin(id: string, current: boolean) {
    await updateDoc(doc(db, 'news', id), { pinned: !current });
  }

  const typeColor = {
    news: 'border-blue-700 text-blue-400',
    alert: 'border-red-700 text-red-400',
    promo: 'border-purple-700 text-purple-400',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 h-full">
      {/* Compose */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-[#E8650A]" />
          <h2 className="text-lg font-semibold">Publish News</h2>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">Headline *</Label>
          <Input
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            placeholder="Breaking: Hammer Radio goes 24/7..."
            className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 focus:border-[#E8650A]"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-gray-300">Body <span className="text-gray-500">(optional)</span></Label>
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Full story details..."
            rows={4}
            className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 focus:border-[#E8650A] resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-gray-300">Type</Label>
            <Select value={type} onValueChange={(v: 'news' | 'alert' | 'promo') => setType(v)}>
              <SelectTrigger className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0D1525] border-[rgba(232,101,10,0.25)]">
                <SelectItem value="news">📰 News</SelectItem>
                <SelectItem value="alert">🚨 Alert</SelectItem>
                <SelectItem value="promo">🎉 Promo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Link <span className="text-gray-500">(optional)</span></Label>
            <Input
              value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://..."
              className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 focus:border-[#E8650A]"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={pinned}
            onCheckedChange={setPinned}
            className="data-[state=checked]:bg-[#E8650A]"
          />
          <Label className="text-gray-300 cursor-pointer" onClick={() => setPinned(!pinned)}>
            Pin to top
          </Label>
        </div>

        <Button
          onClick={handlePublish}
          disabled={publishing || !headline.trim()}
          className="w-full bg-[#E8650A] hover:bg-[#E8650A]/90 text-white font-bold"
        >
          <Plus className="w-4 h-4 mr-2" />
          {publishing ? 'Publishing…' : 'Publish Article'}
        </Button>
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-gray-300">Published ({articles.length})</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-gray-600 text-center py-8">No articles published yet</p>
        ) : (
          <ScrollArea className="flex-1 h-[500px]">
            <div className="space-y-2">
              {articles.map(a => (
                <div key={a.id} className={`bg-[#0D1525] border rounded-lg p-3 space-y-1 ${a.pinned ? 'border-[#E8650A]/40' : 'border-[rgba(232,101,10,0.1)]'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.pinned && <Pin className="w-3 h-3 text-[#E8650A] shrink-0" />}
                        <p className="font-semibold text-white text-sm">{a.headline}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-[10px] ${typeColor[a.type]}`}>
                          {a.type}
                        </Badge>
                        <span className="text-[10px] text-gray-600">
                          {new Date(a.ts).toLocaleString()}
                        </span>
                      </div>
                      {a.body && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.body}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {a.link && (
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-600 hover:text-blue-400" asChild>
                          <a href={a.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`w-7 h-7 ${a.pinned ? 'text-[#E8650A]' : 'text-gray-600 hover:text-[#E8650A]'}`}
                        onClick={() => togglePin(a.id, a.pinned)}
                        title={a.pinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="w-7 h-7 text-gray-600 hover:text-red-400"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
