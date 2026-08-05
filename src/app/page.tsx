"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X, Sparkles, Zap, Layers, Lock, Video, Play, MonitorSmartphone, Laptop, Globe } from "lucide-react";
import { FaApple, FaWindows, FaUbuntu, FaChrome, FaEdge, FaGoogle, FaAndroid } from "react-icons/fa";
import { SiBrave, SiArc } from "react-icons/si";
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-dvh overflow-x-hidden bg-black text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/10 blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[150px]" />
      </div>

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-black/80 backdrop-blur-xl border-b border-white/10 shadow-2xl h-16 sm:h-20"
            : "bg-transparent border-b border-transparent h-20 sm:h-28"
        }`}
      >
        <div className="max-w-7xl mx-auto w-full h-full flex items-center justify-between px-4 sm:px-6 md:px-12">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-400 p-[2px] shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <div className="w-full h-full bg-black rounded-md flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-gradient-to-br from-white to-cyan-200 rounded-sm" />
              </div>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              FlowDoverz
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-base font-bold text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#platform" className="text-base font-bold text-slate-400 hover:text-white transition-colors">Platform</a>
            <a href="#workflow" className="text-base font-bold text-slate-400 hover:text-white transition-colors">Workflow</a>
            <a href="#faq" className="text-base font-bold text-slate-400 hover:text-white transition-colors">FAQ</a>
            <Link href="/pricing" className="text-base font-bold text-slate-400 hover:text-white transition-colors">Pricing</Link>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-bold text-slate-300 hover:text-white transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-6 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:scale-105 hover:shadow-[0_0_25px_rgba(34,211,238,0.6)] transition-all duration-300"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden text-white" onClick={toggleMobileMenu}>
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 backdrop-blur-2xl flex flex-col pt-24 px-6 gap-6 md:hidden">
          <a href="#features" onClick={closeMenu} className="text-2xl font-bold text-white border-b border-white/10 pb-4">Features</a>
          <a href="#platform" onClick={closeMenu} className="text-2xl font-bold text-white border-b border-white/10 pb-4">Platform</a>
          <a href="#workflow" onClick={closeMenu} className="text-2xl font-bold text-white border-b border-white/10 pb-4">Workflow</a>
          <a href="#faq" onClick={closeMenu} className="text-2xl font-bold text-white border-b border-white/10 pb-4">FAQ</a>
          <Link href="/pricing" onClick={closeMenu} className="text-2xl font-bold text-white border-b border-white/10 pb-4">Pricing</Link>
          
          <div className="mt-8 flex flex-col gap-4">
            <Link href="/login" onClick={closeMenu} className="text-center px-5 py-4 text-base font-bold text-slate-300 border border-white/10 hover:bg-white/5 rounded-2xl transition-colors">
              Login
            </Link>
            <Link href="/signup" onClick={closeMenu} className="text-center px-5 py-4 text-base font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-2xl shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all">
              Get Started
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative min-h-[100dvh] flex flex-col items-center justify-center pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 text-center z-10 overflow-hidden">
        {/* Subtle Background Grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs sm:text-sm font-semibold mb-8 backdrop-blur-md animate-[fade-in-down_1s_ease-out]">
          <Sparkles size={16} className="text-cyan-400" /> Unlock the Power of Veo 3.1
        </div>
        
        <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-[100px] font-black leading-[1.05] tracking-tighter max-w-5xl mx-auto mb-6 sm:mb-8 text-white relative z-10 px-2">
          Create Cinematic AI Videos <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-emerald-400">Instantly.</span>
        </h1>
        
        <p className="text-base sm:text-lg md:text-2xl text-slate-400 max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed font-medium relative z-10 px-2">
          Direct, unrestricted access to Google Flow. No waitlists. No complex cloud billing. Just pure creative freedom natively in your browser.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full relative z-10 mb-16">
          <Link
            href="/login?tab=register"
            className="w-full sm:w-auto px-8 py-4 text-base md:text-lg font-bold text-black bg-white rounded-full hover:scale-105 hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] transition-all flex items-center justify-center gap-2"
          >
            Start Free Trial <Play size={18} className="fill-black" />
          </Link>
          <a
            href="#features"
            className="w-full sm:w-auto px-8 py-4 text-base md:text-lg font-bold text-white bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all flex items-center justify-center"
          >
            Explore Features
          </a>
        </div>

        {/* Social Proof / Avatars */}
        <div className="flex flex-col items-center gap-3 relative z-10 opacity-80">
          <div className="flex -space-x-3">
            <img className="w-10 h-10 rounded-full border-2 border-black object-cover" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="User 1" />
            <img className="w-10 h-10 rounded-full border-2 border-black object-cover" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=100&q=80" alt="User 2" />
            <img className="w-10 h-10 rounded-full border-2 border-black object-cover" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" alt="User 3" />
            <img className="w-10 h-10 rounded-full border-2 border-black object-cover" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80" alt="User 4" />
            <div className="w-10 h-10 rounded-full border-2 border-black bg-cyan-900/50 flex items-center justify-center text-xs font-bold text-cyan-400 backdrop-blur-md">
              +2k
            </div>
          </div>
          <span className="text-sm font-medium text-slate-400">Trusted by 2,000+ creators worldwide</span>
        </div>


      </section>

      <CompactFeatures />

      <SupportedPlatforms />

      {/* Horizontal Workflow Grid */}
      <section id="workflow" className="py-16 sm:py-32 px-4 sm:px-6 relative z-10 max-w-6xl mx-auto w-full">
        <div className="text-center mb-24">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-white">How it Works</h2>
          <p className="text-slate-400 text-lg">Three steps to your first render.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Step 1 */}
          <div className="relative flex flex-col items-center text-center group">
             <div className="w-24 h-24 rounded-full bg-[#050505] border border-white/10 flex items-center justify-center mb-8 relative z-10 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition-all duration-500">
               <div className="absolute inset-2 rounded-full border border-dashed border-white/20 group-hover:border-cyan-400/50 group-hover:rotate-180 transition-all duration-1000" />
               <span className="text-3xl font-black text-white group-hover:text-cyan-400 transition-colors duration-500">1</span>
             </div>
             <h3 className="text-xl font-bold text-white mb-4">Create Account</h3>
             <p className="text-slate-400 leading-relaxed max-w-xs">Sign up for free and access your FlowDoverz dashboard instantly.</p>
          </div>

          {/* Step 2 */}
          <div className="relative flex flex-col items-center text-center group">
             <div className="w-24 h-24 rounded-full bg-[#050505] border border-white/10 flex items-center justify-center mb-8 relative z-10 group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all duration-500">
               <div className="absolute inset-2 rounded-full border border-dashed border-white/20 group-hover:border-blue-400/50 group-hover:rotate-180 transition-all duration-1000" />
               <span className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors duration-500">2</span>
             </div>
             <h3 className="text-xl font-bold text-white mb-4">Install Bridge</h3>
             <p className="text-slate-400 leading-relaxed max-w-xs">Add our secure, lightweight Chrome extension to enable the proxy connection.</p>
          </div>

          {/* Step 3 */}
          <div className="relative flex flex-col items-center text-center group">
             <div className="w-24 h-24 rounded-full bg-[#050505] border border-white/10 flex items-center justify-center mb-8 relative z-10 group-hover:border-emerald-500/50 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all duration-500">
               <div className="absolute inset-2 rounded-full border border-dashed border-white/20 group-hover:border-emerald-400/50 group-hover:rotate-180 transition-all duration-1000" />
               <span className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors duration-500">3</span>
             </div>
             <h3 className="text-xl font-bold text-white mb-4">Launch Flow</h3>
             <p className="text-slate-400 leading-relaxed max-w-xs">Click the Launch button. You're securely authenticated and ready to generate.</p>
          </div>
        </div>
      </section>

      <FaqSection />

      {/* Pre-footer CTA */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 relative z-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center text-center bg-white/[0.02] border border-white/5 rounded-3xl p-12 md:p-16 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight relative z-10">Ready to start generating?</h2>
          <p className="text-slate-400 text-lg mb-8 max-w-xl relative z-10">
            Join thousands of creators using FlowDoverz to access premium Google AI models securely from anywhere.
          </p>
          <Link 
            href="/login?tab=register"
            className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] relative z-10"
          >
            Get Started for Free
          </Link>
        </div>
      </section>

      {/* Footer Area with Massive Glow */}
      <footer className="relative z-10 bg-[#050505] pt-12 sm:pt-16 pb-10 sm:pb-12 px-4 sm:px-6 overflow-hidden border-t border-white/10">
        {/* Massive Ambient Bottom Glow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Main Footer Links */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
            <div className="md:col-span-6 flex flex-col items-center md:items-start text-center md:text-left">
              <div className="flex items-center gap-3 mb-6 group cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 p-[2px] group-hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all duration-500">
                  <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 bg-gradient-to-br from-white to-cyan-200 rounded-sm" />
                  </div>
                </div>
                <span className="text-2xl font-extrabold tracking-tight text-white group-hover:text-cyan-400 transition-colors duration-300">FlowDoverz</span>
              </div>
              <p className="text-slate-400 text-base max-w-sm leading-relaxed mb-8">
                The premium gateway to next-generation AI video rendering. Create without limits.
              </p>
            </div>
            
            <div className="md:col-span-3">
              <h4 className="text-white font-black text-lg tracking-wider uppercase mb-6">Product</h4>
              <div className="flex flex-col gap-4">
                <a href="#features" className="text-slate-400 hover:text-white text-sm transition-all duration-300 hover:translate-x-1 flex items-center group">Features</a>
                <a href="#workflow" className="text-slate-400 hover:text-white text-sm transition-all duration-300 hover:translate-x-1 flex items-center group">How It Works</a>
                <Link href="/pricing" className="text-slate-400 hover:text-white text-sm transition-all duration-300 hover:translate-x-1 flex items-center group">Pricing</Link>
                <a href="#faq" className="text-slate-400 hover:text-white text-sm transition-all duration-300 hover:translate-x-1 flex items-center group">FAQ</a>
              </div>
            </div>
            

            
            <div className="md:col-span-3">
              <h4 className="text-white font-black text-lg tracking-wider uppercase mb-6">Support</h4>
              <div className="flex flex-col gap-4">
                <a href="https://wa.me/0000000000" className="text-slate-400 hover:text-white text-sm transition-all duration-300 hover:translate-x-1 flex items-center group">WhatsApp Help</a>
                <a href="mailto:support@flowdoverz.app" className="text-slate-400 hover:text-white text-sm transition-all duration-300 hover:translate-x-1 flex items-center group">Contact Email</a>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} FlowDoverz. All rights reserved.
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="text-slate-500 text-sm hover:text-white cursor-pointer transition-colors duration-300">Privacy Policy</Link>
              <Link href="/terms" className="text-slate-500 text-sm hover:text-white cursor-pointer transition-colors duration-300">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "How does the connection bridge actually work?",
      a: "FlowDoverz acts as a secure access proxy. We manage premium Google AI developer accounts on our end. By downloading our lightweight extension, your browser is safely authenticated to work inside the official Google Flow dashboard."
    },
    {
      q: "Do I need a credit card to try it?",
      a: "No credit card is required for the free trial. Simply register an account and start using the service instantly during your 14-day trial period."
    },
    {
      q: "Is the browser extension safe?",
      a: "Yes. Our extension is strictly scoped to only interact with labs.google.com. It does not access, modify, or track any other browser data, personal info, or websites."
    },
    {
      q: "What video models are supported?",
      a: "You get full, unrestricted access to Google's latest models including Veo 3.1 for high-fidelity cinematic video generation and Imagen 3 for ultra-realistic images."
    }
  ];

  return (
    <section id="faq" className="py-16 sm:py-32 px-4 sm:px-6 relative z-10 max-w-3xl mx-auto w-full border-t border-white/10">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-black mb-6 text-white tracking-tight">Got Questions?</h2>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <FaqItem 
            key={i} 
            question={faq.q} 
            answer={faq.a} 
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </div>
    </section>
  );
}

function FaqItem({ question, answer, isOpen, onToggle }: { question: string, answer: string, isOpen: boolean, onToggle: () => void }) {
  return (
    <div 
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-500 cursor-pointer ${
        isOpen 
          ? 'bg-gradient-to-r from-cyan-500/10 to-transparent border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.1)]' 
          : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
      }`}
      onClick={onToggle}
    >
      <div className="p-6 md:p-8 flex items-center justify-between gap-4">
        <h3 className={`font-bold text-base md:text-lg transition-colors duration-300 ${
          isOpen ? 'text-white' : 'text-slate-300 group-hover:text-white'
        }`}>
          {question}
        </h3>
        
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
          isOpen 
            ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.6)]' 
            : 'bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-white group-hover:scale-110'
        }`}>
          <ChevronDown size={20} className={`transition-transform duration-500 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>
      
      <div 
        className={`transition-all duration-500 overflow-hidden ${
          isOpen ? 'max-h-96 opacity-100 pb-8' : 'max-h-0 opacity-0 pb-0'
        }`}
      >
        <div className="px-6 md:px-8 text-slate-400 text-sm md:text-base leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

function CompactFeatures() {
  const features = [
    {
      title: "Native Google UI",
      desc: "Securely authenticates and injects premium sessions straight into your local browser.",
      icon: <MonitorSmartphone size={22} className="text-cyan-400 group-hover:text-cyan-300 transition-colors" />,
      glow: "bg-cyan-500/10 group-hover:bg-cyan-500/20"
    },
    {
      title: "Next-Gen Video",
      desc: "Unlock the unrestricted capabilities of Veo 3.1 and Imagen 3 for 60fps cinematic renders.",
      icon: <Video size={22} className="text-emerald-400 group-hover:text-emerald-300 transition-colors" />,
      glow: "bg-emerald-500/10 group-hover:bg-emerald-500/20"
    },
    {
      title: "100% Private",
      desc: "FlowDoverz creates completely isolated sessions. Your creative IP is secured and never shared.",
      icon: <Lock size={22} className="text-cyan-400 group-hover:text-cyan-300 transition-colors" />,
      glow: "bg-cyan-500/10 group-hover:bg-cyan-500/20"
    }
  ];

  return (
    <section id="features" className="py-12 sm:py-16 md:py-24 px-4 sm:px-6 relative z-10 w-full max-w-full border-t border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            Core Capabilities
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Everything you need to produce cinematic content, packed into a seamless workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
          {features.map((f, i) => (
            <div 
              key={i} 
              className="group relative p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.05] hover:border-white/[0.1] hover:shadow-2xl hover:shadow-white/[0.02] transition-all duration-500 overflow-hidden"
            >
              {/* Top highlight line on hover */}
              <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/[0.2] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              {/* Subtle radial glow in the corner */}
              <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full blur-[60px] transition-colors duration-500 ${f.glow}`} />
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/[0.08] shadow-inner flex items-center justify-center mb-8 group-hover:bg-white/[0.06] group-hover:scale-110 transition-all duration-500">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white mb-3">
                  {f.title}
                </h3>
                <p className="text-base text-slate-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupportedPlatforms() {
  const platforms = [
    { 
      category: "Operating Systems", 
      icon: <Laptop size={22} className="text-cyan-400 group-hover:text-cyan-300 transition-colors" />,
      glow: "from-cyan-500/0 via-cyan-400/40 to-cyan-500/0",
      items: [
        { name: "Windows 11", icon: <FaWindows size={28} /> },
        { name: "Apple (macOS)", icon: <FaApple size={28} /> },
        { name: "Android", icon: <FaAndroid size={28} /> },
        { name: "iOS", icon: <FaApple size={28} /> }
      ]
    },
    { 
      category: "Supported Browsers", 
      icon: <Globe size={22} className="text-blue-400 group-hover:text-blue-300 transition-colors" />,
      glow: "from-blue-500/0 via-blue-400/40 to-blue-500/0",
      items: [
        { name: "Google Chrome", icon: <FaChrome size={28} /> },
        { name: "Microsoft Edge", icon: <FaEdge size={28} /> },
        { name: "Brave", icon: <SiBrave size={28} /> },
        { name: "Arc Browser", icon: <SiArc size={28} /> }
      ]
    },
    { 
      category: "Supported AI Models", 
      icon: <Sparkles size={22} className="text-emerald-400 group-hover:text-emerald-300 transition-colors" />,
      glow: "from-emerald-500/0 via-emerald-400/40 to-emerald-500/0",
      items: [
        { name: "Google Veo 3.1 & Imagen 3", icon: <FaGoogle size={28} /> }
      ]
    }
  ];

  return (
    <section id="platform" className="py-16 sm:py-32 px-4 sm:px-6 border-y border-white/5 bg-[#030303] relative z-10 overflow-hidden w-full max-w-full">
      {/* Huge background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-gradient-to-b from-cyan-900/20 via-emerald-900/10 to-transparent blur-[100px] pointer-events-none opacity-60" />
      
      <div className="max-w-5xl mx-auto text-center mb-20 relative z-10">
        <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">Works where you work.</h2>
        <p className="text-slate-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed px-2">
          FlowDoverz is universally compatible with your favorite environments, operating entirely locally for zero latency.
        </p>
      </div>
      
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        {platforms.map((p, i) => (
          <div key={i} className="group relative p-8 md:p-10 rounded-3xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.05] hover:border-white/[0.15] hover:bg-white/[0.02] transition-all duration-500 shadow-2xl shadow-black/50 flex flex-col items-center text-center">
            {/* Top glowing line on hover */}
            <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${p.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            
            <div className="relative mb-8 group-hover:-translate-y-1 transition-transform duration-500">
              <div className={`absolute inset-0 blur-2xl opacity-20 group-hover:opacity-50 transition-opacity duration-500 rounded-full ${
                i === 0 ? 'bg-cyan-500' : 
                i === 1 ? 'bg-blue-500' : 
                'bg-emerald-500'
              }`} />
              <div className={`relative w-16 h-16 rounded-full border flex items-center justify-center shadow-inner transition-all duration-500 ${
                 i === 0 ? 'bg-cyan-500/10 border-cyan-500/20 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 
                 i === 1 ? 'bg-blue-500/10 border-blue-500/20 group-hover:bg-blue-500/20 group-hover:border-blue-500/40 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]' : 
                 'bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/40 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              }`}>
                {p.icon}
              </div>
            </div>
            
            <h3 className={`text-sm font-bold tracking-[0.2em] uppercase mb-10 bg-clip-text text-transparent bg-gradient-to-r ${
              i === 0 ? 'from-cyan-100 to-cyan-500' : 
              i === 1 ? 'from-blue-100 to-blue-500' : 
              'from-emerald-100 to-emerald-500'
            }`}>
              {p.category}
            </h3>

            {/* Mac-style Dock Container for Logos */}
            <div className="flex items-center justify-center p-2 rounded-2xl bg-black/50 border border-white/5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
              {p.items.map(item => (
                <div 
                  key={item.name} 
                  title={item.name}
                  className="group/item flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl hover:bg-white/10 transition-all duration-300 cursor-pointer"
                >
                  <div className={`transition-all duration-300 text-white/40 group-hover/item:scale-110 group-hover/item:text-white ${
                    i === 0 ? 'group-hover/item:drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 
                    i === 1 ? 'group-hover/item:drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]' : 
                    'group-hover/item:drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                  }`}>
                    {item.icon}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

