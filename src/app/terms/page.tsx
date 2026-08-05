import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Terms of Service — FlowDoverz",
  description: "Terms of Service for FlowDoverz.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#050505] text-slate-100 font-sans selection:bg-cyan-500/30 relative w-full max-w-full">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none overflow-hidden" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 relative z-10 w-full min-w-0">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-slate-400 hover:text-emerald-400 font-medium mb-12 transition-all duration-300 hover:-translate-x-2 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 px-4 py-2 rounded-xl"
        >
          <ChevronLeft size={20} />
          Back to Home
        </Link>
        
        <div className="mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-400 mb-6 tracking-tight break-words">Terms of Service</h1>
          <div className="inline-flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-2 rounded-full text-sm font-semibold tracking-wide">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Last Updated: {new Date().toLocaleDateString()}
          </div>
        </div>
        
        <div className="space-y-8 sm:space-y-12 text-slate-300 leading-relaxed text-base sm:text-lg bg-white/[0.02] border border-white/5 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 pointer-events-none" />
          
          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-emerald-400 font-mono text-xl">01</span> Acceptance of Terms
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              By accessing and using FlowDoverz ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service. FlowDoverz provides a secure proxy access layer to Google AI tools and services.
            </p>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-emerald-400 font-mono text-xl">02</span> Description of Service
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              FlowDoverz manages premium developer accounts to provide users with streamlined access to next-generation AI models, including video generation and image rendering tools. We provide a browser extension and dashboard to facilitate this access safely and securely.
            </p>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-4">
              <span className="text-emerald-400 font-mono text-xl">03</span> User Responsibilities
            </h2>
            <p className="mb-6 group-hover:text-slate-200 transition-colors duration-300">
              When using FlowDoverz, you agree to:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'Provide accurate information when creating an account.',
                'Maintain the security of your account credentials.',
                'Use the generated content in accordance with the origin AI platform\'s guidelines.',
                'Not abuse, reverse engineer, or attempt to circumvent our security proxies.'
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start bg-black/40 p-5 rounded-2xl border border-white/5 hover:border-emerald-500/30 transition-colors duration-300">
                  <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-emerald-400 font-mono text-xl">04</span> Intellectual Property
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              All content generated through our access portal belongs to you, subject to the licensing terms of the underlying AI provider (e.g., Google). FlowDoverz claims no ownership over the prompts you submit or the media you generate. The FlowDoverz platform, extension, and branding are the intellectual property of FlowDoverz.
            </p>
          </section>

          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-emerald-400 font-mono text-xl">05</span> Limitation of Liability
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              FlowDoverz acts solely as an access bridge. We do not guarantee the uptime of the underlying third-party AI services. In no event shall FlowDoverz be liable for any indirect, incidental, special, consequential or punitive damages arising out of your use of the Service.
            </p>
          </section>
          
          <section className="relative z-10 group">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-4">
              <span className="text-emerald-400 font-mono text-xl">06</span> Changes to Terms
            </h2>
            <p className="group-hover:text-slate-200 transition-colors duration-300">
              We reserve the right to modify these terms at any time. We will notify users of any significant changes via email or an announcement on our platform. Continued use of the Service after changes constitutes acceptance of the new terms.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
