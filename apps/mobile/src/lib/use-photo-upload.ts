import { uploadAttachment } from '@smartresidence/api-client';
import {
  IMAGE_MAX_DIMENSION,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_UPLOAD_CONCURRENCY,
} from '@smartresidence/shared-types';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { api } from './api';

export interface PhotoUploadItem {
  id: string;
  /** Local (downscaled) uri used for preview. */
  uri: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  attachmentId?: string;
  error?: string;
  controller?: AbortController;
}

/**
 * Cross-feature mobile photo upload. Handles permissions, picking from the
 * library (incl. iCloud) or camera, converts/downscales each photo
 * (HEIC -> JPEG, capped to a sane dimension) so we never hold or upload a raw
 * multi-MB phone photo, then streams it to the API with progress + cancel.
 */
export function usePhotoUpload(opts?: { maxFiles?: number }) {
  const maxFiles = opts?.maxFiles ?? MAX_ATTACHMENTS_PER_MESSAGE;
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const counter = useRef(0);
  const itemsRef = useRef<PhotoUploadItem[]>([]);
  itemsRef.current = items;

  const attachmentIds = useMemo(
    () =>
      items
        .filter((i) => i.status === 'done' && i.attachmentId)
        .map((i) => i.attachmentId as string),
    [items],
  );
  const uploading = items.some((i) => i.status === 'uploading' || i.status === 'queued');

  const patch = useCallback((id: string, updates: Partial<PhotoUploadItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  }, []);

  const startUpload = useCallback(
    async (id: string, sourceUri: string) => {
      const controller = new AbortController();
      patch(id, { status: 'uploading', progress: 0, error: undefined, controller });
      try {
        // Downscale + transcode to JPEG (covers HEIC from the iCloud library).
        const processed = await ImageManipulator.manipulateAsync(
          sourceUri,
          [{ resize: { width: IMAGE_MAX_DIMENSION } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
        );
        patch(id, { uri: processed.uri });
        const result = await uploadAttachment(
          api,
          {
            uri: processed.uri,
            fileName: `photo-${Date.now()}.jpg`,
            contentType: 'image/jpeg',
          },
          {
            signal: controller.signal,
            onProgress: (fraction) => patch(id, { progress: fraction }),
          },
        );
        patch(id, { status: 'done', progress: 1, attachmentId: result.attachmentId });
      } catch (err) {
        if (controller.signal.aborted) return;
        patch(id, { status: 'error', error: (err as Error).message });
      }
    },
    [patch],
  );

  // Bounded-concurrency scheduler so a bulk selection doesn't transcode +
  // upload every photo at once (which can spike memory and stall on cellular).
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);

  const pump = useCallback(() => {
    while (activeRef.current < MAX_UPLOAD_CONCURRENCY && queueRef.current.length > 0) {
      const id = queueRef.current.shift();
      if (!id) break;
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) continue; // removed while queued
      activeRef.current += 1;
      void startUpload(id, item.uri).finally(() => {
        activeRef.current -= 1;
        pump();
      });
    }
  }, [startUpload]);

  const enqueue = useCallback(
    (ids: string[]) => {
      queueRef.current.push(...ids);
      pump();
    },
    [pump],
  );

  const addAssets = useCallback(
    (uris: string[]) => {
      const remaining = maxFiles - itemsRef.current.length;
      if (remaining <= 0) {
        Alert.alert('Limit reached', `You can attach up to ${maxFiles} photos.`);
        return;
      }
      const accepted = uris.slice(0, remaining);
      const created = accepted.map<PhotoUploadItem>((uri) => ({
        id: `m-${Date.now()}-${counter.current++}`,
        uri,
        status: 'queued',
        progress: 0,
      }));
      setItems((prev) => [...prev, ...created]);
      enqueue(created.map((i) => i.id));
    },
    [enqueue, maxFiles],
  );

  const pickFromLibrary = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach images.');
      return;
    }
    const remaining = maxFiles - itemsRef.current.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, remaining),
      quality: 1,
    });
    if (result.canceled) return;
    addAssets(result.assets.map((a) => a.uri));
  }, [addAssets, maxFiles]);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    addAssets([result.assets[0].uri]);
  }, [addAssets]);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      prev.find((i) => i.id === id)?.controller?.abort();
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      patch(id, { status: 'queued', error: undefined, progress: 0 });
      enqueue([id]);
    },
    [enqueue, patch],
  );

  const reset = useCallback(() => {
    for (const i of itemsRef.current) i.controller?.abort();
    setItems([]);
  }, []);

  return {
    items,
    attachmentIds,
    uploading,
    atLimit: items.length >= maxFiles,
    maxFiles,
    pickFromLibrary,
    takePhoto,
    remove,
    retry,
    reset,
  };
}

export type UsePhotoUpload = ReturnType<typeof usePhotoUpload>;
