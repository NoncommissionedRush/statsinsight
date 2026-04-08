import { OnModuleInit } from '@nestjs/common';
export declare class CacheService implements OnModuleInit {
    private db;
    onModuleInit(): void;
    get<T>(key: string): T | null;
    set(key: string, data: any): void;
}
