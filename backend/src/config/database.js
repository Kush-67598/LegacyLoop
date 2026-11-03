import mongoose from 'mongoose';
import { env } from './env.js';
export async function connectDatabase() { await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 }); return mongoose.connection; }
export async function disconnectDatabase() { await mongoose.disconnect(); }
export function getDatabaseStatus() { return ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] ?? 'unknown'; }
