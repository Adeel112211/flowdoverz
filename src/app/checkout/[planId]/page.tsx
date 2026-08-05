"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, ShieldCheck, CreditCard, Send, Upload, X } from "lucide-react";
import Link from "next/link";
import { getSession } from "@/lib/auth";

const PLANS = {
  solo: { name: "Solo", price: "PKR 999" },
  team: { name: "Team", price: "PKR 1,999" },
};

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.planId as string;
  const plan = PLANS[planId as keyof typeof PLANS];

  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace(`/login?callbackUrl=/checkout/${planId}`);
      return;
    }

    if (!plan) {
      router.push("/pricing");
    }
  }, [plan, planId, router]);

  if (!plan) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with 0.6 quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        setScreenshot(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!transactionId.trim()) {
      setError("Please enter your Sender Account Number.");
      return;
    }

    if (!screenshot) {
      setError("Please upload a screenshot of your payment.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, transactionId, screenshot }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(true);
      } else {
        if (data.code === "NOT_LOGGED_IN") {
          router.push(`/login?callbackUrl=/checkout/${planId}`);
        } else {
          setError(data.error || "Something went wrong.");
        }
      }
    } catch (err) {
      setError("Failed to submit payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh overflow-x-hidden bg-[#030308] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-[#0a0a10] border border-white/10 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-cyan-400" />
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Payment Submitted!</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            We have received your payment request (TID: <span className="text-white font-mono">{transactionId}</span>). 
            Our team will verify the payment and activate your subscription shortly.
          </p>
          <Link 
            href="/dashboard"
            className="block w-full rounded-xl bg-white text-black font-bold py-3 hover:bg-slate-200 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#030308] text-slate-200 selection:bg-cyan-500/30 w-full max-w-full">
      <header className="h-16 sm:h-20 border-b border-white/[0.06] flex items-center px-4 sm:px-6 sticky top-0 z-40 bg-[#030308]/90 backdrop-blur-md">
        <Link href="/pricing" className="flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Back to Pricing
        </Link>
      </header>

      <main className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          
          {/* Left: Payment Instructions */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Complete Payment</h1>
            <p className="text-slate-400 text-sm mb-8">
              Send <span className="text-white font-bold">{plan.price}</span> to any of the accounts below, then submit your transaction ID.
            </p>

            <div className="space-y-4">
              {/* JazzCash */}
              <div className="bg-[#0a0a10] border border-white/5 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Send size={14} className="text-red-400" />
                  </div>
                  <h3 className="font-bold text-white">JazzCash</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                    <span className="text-slate-500 shrink-0">Account Name:</span>
                    <span className="text-white font-mono break-all text-right sm:text-left">[Your Name]</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                    <span className="text-slate-500 shrink-0">Account Number:</span>
                    <span className="text-white font-mono text-base sm:text-lg break-all text-right sm:text-left">0300-0000000</span>
                  </div>
                </div>
              </div>

              {/* EasyPaisa */}
              <div className="bg-[#0a0a10] border border-white/5 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Send size={14} className="text-green-400" />
                  </div>
                  <h3 className="font-bold text-white">EasyPaisa</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                    <span className="text-slate-500 shrink-0">Account Name:</span>
                    <span className="text-white font-mono break-all text-right sm:text-left">[Your Name]</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                    <span className="text-slate-500 shrink-0">Account Number:</span>
                    <span className="text-white font-mono text-base sm:text-lg break-all text-right sm:text-left">0300-0000000</span>
                  </div>
                </div>
              </div>

              {/* Bank Transfer */}
              <div className="bg-[#0a0a10] border border-white/5 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <CreditCard size={14} className="text-blue-400" />
                  </div>
                  <h3 className="font-bold text-white">Bank Transfer</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                    <span className="text-slate-500 shrink-0">Bank Name:</span>
                    <span className="text-white font-mono break-all text-right sm:text-left">Meezan Bank</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                    <span className="text-slate-500 shrink-0">Account Title:</span>
                    <span className="text-white font-mono break-all text-right sm:text-left">[Your Name]</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4">
                    <span className="text-slate-500 shrink-0">IBAN / A/C:</span>
                    <span className="text-white font-mono break-all text-right sm:text-left">PK00MEZN000000000000</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Submission Form */}
          <div className="bg-gradient-to-b from-[#0a0a10] to-[#030308] border border-white/10 rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:sticky lg:top-8 min-w-0">
            <div className="mb-6 sm:mb-8 pb-6 border-b border-white/[0.06]">
              <div className="text-sm font-semibold text-cyan-400 mb-1">{plan.name} Plan</div>
              <div className="flex items-end gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white">{plan.price}</span>
                <span className="text-slate-500 pb-1">/month</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="tid" className="block text-sm font-semibold text-slate-300 mb-2">
                  Sender Account Number
                </label>
                <input
                  id="tid"
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. 029348123 or 03001234567"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Payment Screenshot
                </label>
                {screenshot ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/10 group">
                    <img src={screenshot} alt="Screenshot" className="w-full h-40 object-cover opacity-80" />
                    <button 
                      type="button" 
                      onClick={() => setScreenshot(null)}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-md hover:bg-red-500/80 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-xl cursor-pointer hover:border-cyan-500/50 hover:bg-cyan-500/5 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload size={24} className="text-slate-500 mb-2" />
                      <p className="text-sm text-slate-400 font-medium">Click to upload screenshot</p>
                      <p className="text-xs text-slate-600 mt-1">JPEG, PNG, or WebP</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 px-4 py-3.5 text-sm font-bold text-slate-950 transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none shadow-[0_0_20px_rgba(34,211,238,0.2)]"
              >
                {loading ? "Submitting..." : "Submit Payment"}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck size={14} />
              Secure manual payment processing
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
