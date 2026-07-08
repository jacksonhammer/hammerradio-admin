'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Radio } from 'lucide-react';

const ADMIN_PASSWORD = 'HammerRadio2026!';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('hr_admin_auth', 'true');
      router.push('/dashboard');
    } else {
      setError('Incorrect password. Try again.');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#080D1A] p-4">
      <Card className="w-full max-w-md bg-[#0D1525] border-[rgba(232,101,10,0.25)]">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#E8650A] flex items-center justify-center">
              <Radio className="w-7 h-7 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">Hammer Radio</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Admin Control Room</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">Admin Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="bg-[#080D1A] border-[rgba(232,101,10,0.25)] text-white placeholder:text-gray-600 focus:border-[#E8650A]"
                autoFocus
                required
              />
            </div>

            {error && (
              <Alert className="border-red-800 bg-red-950/40">
                <AlertDescription className="text-red-400 text-sm">{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#E8650A] hover:bg-[#E8650A]/90 text-white font-bold py-2"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Checking…' : 'Enter Control Room'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
