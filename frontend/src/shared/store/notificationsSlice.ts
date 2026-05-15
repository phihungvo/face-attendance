import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { NotificationItem } from "../api/notifications";
import { getUnreadCount, listNotifications, markAllRead, markNotificationRead } from "../api/notifications";

type State = {
  items: NotificationItem[];
  nextCursor: string | null;
  loading: boolean;
  unread: number;
  error: string | null;
};

const initialState: State = {
  items: [],
  nextCursor: null,
  loading: false,
  unread: 0,
  error: null
};

export const fetchUnread = createAsyncThunk<number, { token: string }>("notifications/unread", async ({ token }) => {
  return getUnreadCount(token);
});

export const fetchNotifications = createAsyncThunk<
  { items: NotificationItem[]; nextCursor: string | null; append: boolean },
  { token: string; cursor?: string | null; limit?: number; append?: boolean }
>("notifications/list", async ({ token, cursor, limit, append }) => {
  const res = await listNotifications(token, { cursor: cursor ?? null, limit: limit ?? 20 });
  return { ...res, append: !!append };
});

export const readOne = createAsyncThunk<{ id: string }, { token: string; id: string }>("notifications/readOne", async ({ token, id }) => {
  await markNotificationRead(token, id);
  return { id };
});

export const readAll = createAsyncThunk<void, { token: string }>("notifications/readAll", async ({ token }) => {
  await markAllRead(token);
});

const slice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    pushRealtime(state, action: PayloadAction<{ item: NotificationItem; unread?: number | null }>) {
      const { item, unread } = action.payload;
      state.items = [item, ...state.items.filter((x) => x.id !== item.id)];
      if (typeof unread === "number") state.unread = unread;
      else if (!item.isRead) state.unread += 1;
    }
  },
  extraReducers: (b) => {
    b.addCase(fetchUnread.fulfilled, (s, a) => {
      s.unread = a.payload;
    });
    b.addCase(fetchNotifications.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchNotifications.fulfilled, (s, a) => {
      s.loading = false;
      s.nextCursor = a.payload.nextCursor;
      if (a.payload.append) s.items = [...s.items, ...a.payload.items];
      else s.items = a.payload.items;
    });
    b.addCase(fetchNotifications.rejected, (s, a) => {
      s.loading = false;
      s.error = a.error.message ?? "Không tải được notifications";
    });
    b.addCase(readOne.fulfilled, (s, a) => {
      const it = s.items.find((x) => x.id === a.payload.id);
      if (it && !it.isRead) {
        it.isRead = true;
        s.unread = Math.max(0, s.unread - 1);
      }
    });
    b.addCase(readAll.fulfilled, (s) => {
      for (const it of s.items) it.isRead = true;
      s.unread = 0;
    });
  }
});

export const { pushRealtime } = slice.actions;
export const notificationsReducer = slice.reducer;

