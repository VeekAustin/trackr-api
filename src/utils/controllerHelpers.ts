import { Document } from "mongoose";
import { AppError } from "./AppError";

export async function findOrFail<T extends Document>(
    model: { findById: (id: string) => Promise<T | null> },
    id: string,
    label: string
):Promise<T> {
    const doc = await model.findById(id);
    if(!doc) throw new AppError(`${label} not found`, 404);
    return doc;
}

export function assertOwnership(
    resourceUserId: unknown,
    requestUserId: string,
    label: string
):void {
    if(String(resourceUserId) !== requestUserId) {
        throw new AppError(`Not authorised to modify this ${label}`, 403);
    }
}

export function isDuplicateKeyError(error:unknown): error is { code: number} {
    return typeof error === 'object' && error !== null && 'code' in error && (error as {code: unknown}).code === 11000;
}