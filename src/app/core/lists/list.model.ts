export type ListVisibility = 'private' | 'public';

export interface AppList {
  id: string;
  name: string;
  nameKey: string;
  icon: string;
  visibility: ListVisibility;
  authorUid: string;
  authorName: string;
  entryCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ListEntry {
  id: string;
  listId: string;
  text: string;
  authorUid: string;
  authorName: string;
  createdAt: Date | null;
}

export interface CreateListInput {
  name: string;
  icon: string;
  visibility: ListVisibility;
}

export interface UpdateListInput {
  name: string;
  visibility: ListVisibility;
}
