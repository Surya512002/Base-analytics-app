"use client";

import React, { useRef, useState } from "react";
import { X, Globe, Twitter, Send, ImagePlus, AlertCircle } from "lucide-react";

interface IdentityStepProps {
  name: string;
  onNameChange: (v: string) => void;
  symbol: string;
  onSymbolChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  website: string;
  onWebsiteChange: (v: string) => void;
  twitter: string;
  onTwitterChange: (v: string) => void;
  telegram: string;
  onTelegramChange: (v: string) => void;
  imagePreview: string | null;
  onPickImage: (file: File | null) => void;
  onRemoveImage: () => void;
  imageUploading?: boolean;
}

function isValidHttpUrl(str: string): boolean {
  if (!str.trim()) return true;
  try {
    const url = new URL(str.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function IdentityStep({
  name,
  onNameChange,
  symbol,
  onSymbolChange,
  description,
  onDescriptionChange,
  website,
  onWebsiteChange,
  twitter,
  onTwitterChange,
  telegram,
  onTelegramChange,
  imagePreview,
  onPickImage,
  onRemoveImage,
  imageUploading: _imageUploading = false,
}: IdentityStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [websiteError, setWebsiteError] = useState(false);

  const handleWebsiteBlur = () => {
    if (website.trim() && !isValidHttpUrl(website)) {
      setWebsiteError(true);
    } else {
      setWebsiteError(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Step Header */}
      <div>
        <h2 className="text-lg font-black text-[var(--ink)]">Token Identity &amp; Branding</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Define your token&apos;s public metadata, symbol, logo, and community links.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
        {/* Image Upload Row */}
        <div>
          <label className="block text-xs font-bold text-[var(--ink)] mb-2">Token Logo</label>
          <div className="flex items-center gap-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />

            <div className="relative group">
              {imagePreview ? (
                <div className="w-20 h-20 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Token preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={onRemoveImage}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-black transition"
                    title="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[#0052FF] hover:bg-[#0052FF]/5 flex flex-col items-center justify-center gap-1 transition text-[var(--ink-muted)] hover:text-[#0052FF] cursor-pointer"
                >
                  <ImagePlus size={20} />
                  <span className="text-[10px] font-bold">Upload</span>
                </button>
              )}
            </div>

            <div className="text-xs text-[var(--ink-muted)] space-y-1">
              <p className="font-medium text-[var(--ink)]">Square image recommended (512×512px)</p>
              <p className="text-[11px]">Supports PNG, JPG, GIF or WebP up to 5MB.</p>
              {imagePreview && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-[11px] font-bold text-[#0052FF] hover:underline"
                >
                  Change image
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Name & Symbol */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="token-name" className="text-xs font-bold text-[var(--ink)]">
                Token Name <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-[var(--ink-dim)]">{name.length}/32</span>
            </div>
            <input
              id="token-name"
              type="text"
              maxLength={32}
              required
              placeholder="e.g. Base Velocity"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-sm text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[#0052FF] focus:ring-1 focus:ring-[#0052FF] transition font-medium"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="token-symbol" className="text-xs font-bold text-[var(--ink)]">
                Symbol / Ticker <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-[var(--ink-dim)]">{symbol.length}/10</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--ink-muted)]">
                $
              </span>
              <input
                id="token-symbol"
                type="text"
                maxLength={10}
                required
                placeholder="VELO"
                value={symbol}
                onChange={(e) => onSymbolChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-sm text-[var(--ink)] uppercase placeholder-[var(--ink-dim)] focus:outline-none focus:border-[#0052FF] focus:ring-1 focus:ring-[#0052FF] transition font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* Description with Character Counter */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="token-desc" className="text-xs font-bold text-[var(--ink)]">
              Description
            </label>
            <span className="text-[10px] text-[var(--ink-dim)]">{description.length}/280</span>
          </div>
          <textarea
            id="token-desc"
            rows={3}
            maxLength={280}
            placeholder="What is this token about? Describe the mission or meme..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-sm text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[#0052FF] focus:ring-1 focus:ring-[#0052FF] transition resize-none leading-relaxed"
          />
        </div>

        {/* Social Links */}
        <div className="space-y-3 pt-1">
          <label className="block text-xs font-bold text-[var(--ink)]">Community &amp; Social Links</label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Website */}
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
                  <Globe size={14} />
                </span>
                <input
                  type="url"
                  placeholder="https://mytoken.xyz"
                  value={website}
                  onChange={(e) => {
                    onWebsiteChange(e.target.value);
                    if (websiteError) setWebsiteError(false);
                  }}
                  onBlur={handleWebsiteBlur}
                  className={`w-full pl-8 pr-3 py-2 rounded-xl border text-xs text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:ring-1 transition ${
                    websiteError
                      ? "border-red-500 bg-red-500/5 focus:border-red-500 focus:ring-red-500"
                      : "border-[var(--border-subtle)] bg-[var(--surface-2)] focus:border-[#0052FF] focus:ring-[#0052FF]"
                  }`}
                />
              </div>
              {websiteError && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                  <AlertCircle size={10} /> Must start with https://
                </p>
              )}
            </div>

            {/* X / Twitter */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
                <Twitter size={14} />
              </span>
              <input
                type="text"
                placeholder="https://x.com/username"
                value={twitter}
                onChange={(e) => onTwitterChange(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[#0052FF] focus:ring-1 focus:ring-[#0052FF] transition"
              />
            </div>

            {/* Telegram */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]">
                <Send size={14} />
              </span>
              <input
                type="text"
                placeholder="https://t.me/channel"
                value={telegram}
                onChange={(e) => onTelegramChange(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs text-[var(--ink)] placeholder-[var(--ink-dim)] focus:outline-none focus:border-[#0052FF] focus:ring-1 focus:ring-[#0052FF] transition"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
