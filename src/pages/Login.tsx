import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'teacher' | 'principal' | 'schooladmin'>('teacher');
  const [loading, setLoading] = useState(false);

  const { login, signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Logged in successfully');
      } else {
        await signup(email, password, name, role);
        toast.success('Account created successfully');
      }
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
      toast.success('Logged in with Google');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Google login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4">
            <span className="text-3xl font-bold text-black">E</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tighter">EduSphere AI</h1>
          <p className="text-zinc-400 mt-2">Smart School Management Platform</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex mb-6 bg-zinc-800 rounded-full p-1">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${isLogin ? 'bg-white text-black' : 'text-zinc-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${!isLogin ? 'bg-white text-black' : 'text-zinc-400'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-zinc-400">Full Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-zinc-600 rounded-2xl px-4 py-3 text-sm" 
                    required 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-zinc-400">Role</label>
                  <select 
                    value={role} 
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full bg-zinc-800 border border-zinc-700 focus:border-zinc-600 rounded-2xl px-4 py-3 text-sm"
                  >
                    <option value="teacher">Teacher</option>
                    <option value="principal">Principal</option>
                    <option value="schooladmin">School Admin</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5 text-zinc-400">Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-zinc-600 rounded-2xl px-4 py-3 text-sm" 
                required 
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-zinc-400">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-zinc-600 rounded-2xl px-4 py-3 text-sm" 
                required 
              />
            </div>

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full py-6 mt-2 rounded-2xl text-base font-semibold"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px bg-zinc-800"></div>
            <span className="text-xs text-zinc-500">OR</span>
            <div className="flex-1 h-px bg-zinc-800"></div>
          </div>

          <Button 
            variant="outline" 
            onClick={handleGoogleLogin} 
            className="w-full py-6 border-zinc-700 hover:bg-zinc-800 rounded-2xl"
          >
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-xs text-zinc-500">
            Demo: Use any email/password for testing.<br />Real Firebase auth enabled.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;