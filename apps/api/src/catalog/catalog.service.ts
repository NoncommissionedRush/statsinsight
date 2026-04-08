import { Injectable } from '@nestjs/common';
import { CatalogEntry } from '@statinsight/types';
import { CATALOG } from './catalog.data';

@Injectable()
export class CatalogService {
  getAll(): CatalogEntry[] {
    return CATALOG;
  }

  findById(id: string): CatalogEntry | undefined {
    return CATALOG.find((entry) => entry.id === id);
  }
}
