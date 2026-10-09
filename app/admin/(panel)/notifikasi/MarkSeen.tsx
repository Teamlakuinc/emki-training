'use client';
import { useEffect } from 'react';
import { markNotificationsSeen } from '@/app/admin/actions';
/** Membuka halaman notifikasi = semua dianggap sudah dibaca. */
export default function MarkSeen() { useEffect(() => { markNotificationsSeen(); }, []); return null; }
