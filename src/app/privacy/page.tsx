import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — FlowDoverz",
  description: "Privacy Policy for FlowDoverz.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#050505] text-slate-100 font-sans selection:bg-cyan-500/30 relative w-full max-w-full">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none overflow-hidden" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative z-10 w-full min-w-0">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 font-medium mb-12 transition-all duration-300 hover:-translate-x-2 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 px-4 py-2 rounded-xl"
        >
          <ChevronLeft size={20} />
          Back to Home
        </Link>
        
        <div className="mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-400 mb-6 tracking-tight break-words">Privacy Policy</h1>
          <div className="inline-flex items-center gap-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-4 py-2 rounded-full text-sm font-semibold tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Last Updated: {new Date().toLocaleDateString()}
          </div>
        </div>
        
        <div className="space-y-8 sm:space-y-12 text-slate-300 leading-relaxed text-base sm:text-lg bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-50 pointer-events-none" />
          
          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-cyan-400 font-mono text-xl">01</span> Introduction
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              At FlowDoverz, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website or use our browser extension. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
            </p>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-cyan-400 font-mono text-xl">02</span> Information We Collect
            </h2>
            <p className="mb-6 group-hover:text-slate-200 transition-colors duration-300">
              We may collect information about you in a variety of ways. The information we may collect includes:
            </p>
            <ul className="space-y-4">
              <li className="flex gap-4 items-start bg-black/40 p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors duration-300">
                <div className="mt-1 w-2 h-2 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                <div>
                  <strong className="text-white block mb-1">Personal Data</strong> 
                  <span className="text-sm">Personally identifiable information, such as your name and email address, that you voluntarily give to us when you register with the Site.</span>
                </div>
              </li>
              <li className="flex gap-4 items-start bg-black/40 p-6 rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-colors duration-300">
                <div className="mt-1 w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                <div>
                  <strong className="text-white block mb-1">Derivative Data</strong> 
                  <span className="text-sm">Information our servers automatically collect when you access the Site, such as your IP address, your browser type, your operating system, and your access times.</span>
                </div>
              </li>
            </ul>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-cyan-400 font-mono text-xl">03</span> Browser Extension Privacy
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              The FlowDoverz browser extension is strictly scoped. It <strong className="text-white">only</strong> interacts with the required Google AI domains (e.g., labs.google.com) to provide proxy authentication. We do not track your browsing history, we do not inject ads, and we do not read data on any other websites you visit.
            </p>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-cyan-400 font-mono text-xl">04</span> Use of Your Information
            </h2>
            <p className="mb-4 group-hover:text-slate-200 transition-colors duration-300">
              Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you to:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Create and manage your account.', 'Process your secure proxy session authentications.', 'Email you regarding your account or order.', 'Increase the efficiency and operation of the Site.'].map((item, i) => (
                <li key={i} className="flex items-center gap-3 bg-white/[0.03] p-4 rounded-xl border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-70" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-cyan-400 font-mono text-xl">05</span> Contact Us
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              If you have questions or comments about this Privacy Policy, please contact us at: <a href="mailto:support@flowdoverz.app" className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors">support@flowdoverz.app</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
