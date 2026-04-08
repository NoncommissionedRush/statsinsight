import { CatalogEntry } from '@statinsight/types';
export declare class CatalogService {
    getAll(): CatalogEntry[];
    findById(id: string): CatalogEntry | undefined;
}
