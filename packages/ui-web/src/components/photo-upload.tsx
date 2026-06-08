'use client';

import { AlertCircle, ImagePlus, Loader2, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

export interface PhotoUploadResult {
  attachmentId: string;
}

export interface PhotoUploadLabels {
  cta: string;
  hint: string;
  retry: string;
  remove: string;
  cancel: string;
  tooMany: string;
}

const DEFAULT_LABELS: PhotoUploadLabels = {
  cta: 'Add photos',
  hint: 'Drag & drop, paste, or click — camera or gallery on mobile',
  retry: 'Retry',
  remove: 'Remove',
  cancel: 'Cancel upload',
  tooMany: 'You can attach up to {max} photos',
};

interface InternalItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'uploading' | 'done' | 'error' | 'canceled';
  progress: number;
  attachmentId?: string;
  error?: string;
  controller?: AbortController;
}

export interface PhotoUploadHandle {
  /** Clear all items (e.g. after the parent form is submitted). */
  reset: () => void;
}

export interface PhotoUploadProps {
  /** Performs the actual upload; returns the created attachment id. */
  upload: (
    file: File,
    opts: { onProgress: (fraction: number) => void; signal: AbortSignal },
  ) => Promise<PhotoUploadResult>;
  /** Called whenever the set of committed attachment ids changes. */
  onChange?: (attachmentIds: string[]) => void;
  maxFiles?: number;
  accept?: string;
  disabled?: boolean;
  labels?: Partial<PhotoUploadLabels>;
  className?: string;
}

let counter = 0;
const nextId = () => `pu-${Date.now()}-${counter++}`;

export const PhotoUpload = React.forwardRef<PhotoUploadHandle, PhotoUploadProps>(
  function PhotoUpload(
    { upload, onChange, maxFiles = 6, accept = 'image/*,.heic,.heif', disabled, labels, className },
    ref,
  ) {
    const t = { ...DEFAULT_LABELS, ...labels };
    const [items, setItems] = React.useState<InternalItem[]>([]);
    const [dragging, setDragging] = React.useState(false);
    const [notice, setNotice] = React.useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const itemsRef = React.useRef<InternalItem[]>([]);
    itemsRef.current = items;

    const emitChange = React.useCallback(
      (next: InternalItem[]) => {
        onChange?.(
          next
            .filter((i) => i.status === 'done' && i.attachmentId)
            .map((i) => i.attachmentId as string),
        );
      },
      [onChange],
    );

    const patch = React.useCallback(
      (id: string, updates: Partial<InternalItem>) => {
        setItems((prev) => {
          const next = prev.map((i) => (i.id === id ? { ...i, ...updates } : i));
          emitChange(next);
          return next;
        });
      },
      [emitChange],
    );

    const startUpload = React.useCallback(
      (item: InternalItem) => {
        const controller = new AbortController();
        patch(item.id, { status: 'uploading', progress: 0, error: undefined, controller });
        upload(item.file, {
          onProgress: (fraction) => patch(item.id, { progress: fraction }),
          signal: controller.signal,
        })
          .then((res) =>
            patch(item.id, { status: 'done', progress: 1, attachmentId: res.attachmentId }),
          )
          .catch((err: unknown) => {
            if (controller.signal.aborted) return;
            patch(item.id, { status: 'error', error: (err as Error).message });
          });
      },
      [patch, upload],
    );

    const addFiles = React.useCallback(
      (files: File[]) => {
        const images = files.filter(
          (f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name),
        );
        if (images.length === 0) return;
        const remaining = maxFiles - itemsRef.current.length;
        if (remaining <= 0) {
          setNotice(t.tooMany.replace('{max}', String(maxFiles)));
          return;
        }
        const accepted = images.slice(0, remaining);
        if (accepted.length < images.length) {
          setNotice(t.tooMany.replace('{max}', String(maxFiles)));
        } else {
          setNotice(null);
        }
        const created = accepted.map<InternalItem>((file) => ({
          id: nextId(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          progress: 0,
        }));
        setItems((prev) => [...prev, ...created]);
        for (const item of created) startUpload(item);
      },
      [maxFiles, startUpload, t.tooMany],
    );

    const removeItem = React.useCallback(
      (id: string) => {
        setItems((prev) => {
          const target = prev.find((i) => i.id === id);
          target?.controller?.abort();
          if (target) URL.revokeObjectURL(target.previewUrl);
          const next = prev.filter((i) => i.id !== id);
          emitChange(next);
          return next;
        });
      },
      [emitChange],
    );

    React.useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          for (const i of itemsRef.current) {
            i.controller?.abort();
            URL.revokeObjectURL(i.previewUrl);
          }
          setItems([]);
          setNotice(null);
          onChange?.([]);
        },
      }),
      [onChange],
    );

    // Revoke any outstanding object URLs on unmount to free memory.
    React.useEffect(
      () => () => {
        for (const i of itemsRef.current) {
          i.controller?.abort();
          URL.revokeObjectURL(i.previewUrl);
        }
      },
      [],
    );

    const onPaste = React.useCallback(
      (e: React.ClipboardEvent) => {
        const files = Array.from(e.clipboardData.files ?? []);
        if (files.length) addFiles(files);
      },
      [addFiles],
    );

    const atLimit = items.length >= maxFiles;

    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <div
          onPaste={onPaste}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !atLimit) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (disabled || atLimit) return;
            addFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center transition-colors',
            dragging
              ? 'border-[rgb(var(--sr-coral))] bg-[rgb(var(--sr-coral)/0.06)]'
              : 'border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-bg))]/40',
            (disabled || atLimit) && 'opacity-60',
          )}
        >
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || atLimit}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[rgb(var(--sr-coral))] hover:bg-[rgb(var(--sr-coral)/0.08)] disabled:pointer-events-none"
          >
            <ImagePlus className="size-4" />
            {t.cta}
          </button>
          <p className="text-xs sr-muted">{t.hint}</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>

        {notice ? <p className="text-xs text-amber-600 dark:text-amber-400">{notice}</p> : null}

        {items.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-[rgb(var(--sr-border))] bg-[rgb(var(--sr-card))]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="size-full object-cover" />

                {item.status === 'uploading' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 text-white">
                    <Loader2 className="size-5 animate-spin" />
                    <span className="text-[11px] font-medium">
                      {Math.round(item.progress * 100)}%
                    </span>
                  </div>
                ) : null}

                {item.status === 'error' ? (
                  <button
                    type="button"
                    onClick={() => startUpload(item)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-600/70 text-white"
                    title={item.error}
                  >
                    <AlertCircle className="size-5" />
                    <span className="text-[11px] font-semibold">{t.retry}</span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={item.status === 'uploading' ? t.cancel : t.remove}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
