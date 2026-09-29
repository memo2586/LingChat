<template>
  <section
    class="pet-side-panel flex h-(--avatar-size) w-(--pet-panel-width) flex-col overflow-hidden
      rounded-[calc(12px*var(--pet-ui-scale))] border border-white/15 bg-neutral-950/50 text-white
      shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl"
  >
    <div class="grid shrink-0 grid-cols-2 border-b border-white/15" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'todo'"
        class="pet-side-tab"
        :class="activeTab === 'todo' ? 'text-cyan-300' : 'text-white/60'"
        @click="activeTab = 'todo'"
      >
        {{ $t("pet.tabs.todo") }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="activeTab === 'history'"
        class="pet-side-tab"
        :class="activeTab === 'history' ? 'text-cyan-300' : 'text-white/60'"
        @click="activeTab = 'history'"
      >
        {{ $t("pet.tabs.interaction") }}
      </button>
      <div
        class="col-span-2 h-0.5 w-1/2 bg-cyan-400 transition-transform duration-300 ease-in-out"
        :class="activeTab === 'history' ? 'translate-x-full' : 'translate-x-0'"
      ></div>
    </div>

    <div class="min-h-0 flex-1 overflow-hidden">
      <div
        class="flex h-full w-[200%] transition-transform duration-300 ease-in-out"
        :class="activeTab === 'history' ? '-translate-x-1/2' : 'translate-x-0'"
      >
        <div class="pet-side-page" role="tabpanel">
          <p v-if="pendingTodos.length === 0" class="text-white/55">
            {{ $t("pet.todo.noPending") }}
          </p>
          <ul v-else class="space-y-[calc(8px*var(--pet-ui-scale))]">
            <li
              v-for="todo in pendingTodos"
              :key="todo.key"
              class="border-b border-white/10 pb-[calc(7px*var(--pet-ui-scale))] leading-relaxed
                wrap-break-word last:border-b-0"
            >
              <span class="whitespace-pre-wrap">{{ todo.text }}</span>
              <span
                class="ml-[calc(4.5px*var(--pet-ui-scale))] inline-block max-w-full rounded-sm
                  bg-sky-400/20 px-[calc(3.75px*var(--pet-ui-scale))] py-[0.75px] align-middle
                  text-[0.75em] text-sky-300"
                >{{ todo.groupTitle }}</span
              >
              <span
                class="ml-[calc(3.75px*var(--pet-ui-scale))] inline-flex align-middle"
                :aria-label="`${t('pet.todo.priority')}: ${todo.priority}`"
              >
                <Star
                  v-for="star in 5"
                  :key="star"
                  class="h-[calc(7.5px*var(--pet-ui-scale))] w-[calc(7.5px*var(--pet-ui-scale))]"
                  :class="star <= todo.priority ? 'fill-sky-400 text-sky-400' : 'text-slate-500'"
                  aria-hidden="true"
                />
              </span>
            </li>
          </ul>
        </div>

        <div
          ref="historyScroll"
          class="pet-side-page"
          role="tabpanel"
          @scroll="handleHistoryScroll"
        >
          <p v-if="historyMessages.length === 0" class="text-white/55">
            {{ $t("pet.history.empty") }}
          </p>
          <div v-else class="space-y-[calc(8px*var(--pet-ui-scale))]">
            <div
              v-for="message in historyMessages"
              :key="message.key"
              :data-history-index="message.key"
              class="flex min-w-0 items-start leading-relaxed"
            >
              <span class="max-w-[42%] shrink-0 wrap-break-word text-cyan-300">
                {{ message.displayName }}:
              </span>
              <span
                class="ml-[calc(6px*var(--pet-ui-scale))] min-w-0 flex-1 wrap-break-word
                  whitespace-pre-wrap"
              >
                {{ message.content }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { getSchedules, SCHEDULES_CHANGED_EVENT } from "@/api/services/schedule";
  import { useGameStore } from "@/stores/modules/game";
  import { listen } from "@tauri-apps/api/event";
  import { Star } from "lucide-vue-next";
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
  import { useI18n } from "vue-i18n";

  const props = defineProps<{ open: boolean }>();
  const gameStore = useGameStore();
  const { t } = useI18n();
  const activeTab = ref<"todo" | "history">("todo");
  const pendingTodos = ref<{ key: string; text: string; priority: number; groupTitle: string }[]>(
    []
  );
  const historyScroll = ref<HTMLElement | null>(null);
  const HISTORY_PAGE_SIZE = 50;
  const MAX_VISIBLE_HISTORY = 150;
  const historyStart = ref(Math.max(0, gameStore.dialogHistory.length - HISTORY_PAGE_SIZE));
  const historyEnd = ref(gameStore.dialogHistory.length);
  let lastHistoryScrollTop = 0;
  let loadingHistoryPage = false;
  let schedulesUnlisten: (() => void) | null = null;
  let loadVersion = 0;

  const historyMessages = computed(() =>
    gameStore.dialogHistory
      .slice(historyStart.value, historyEnd.value)
      .map((message, index) => ({
        key: historyStart.value + index,
        displayName:
          message.displayName ||
          (message.type === "message"
            ? gameStore.userName || t("pet.history.you")
            : t("pet.history.mysteryVoice")),
        content: message.content,
      }))
      .filter((message) => message.content.trim() !== "")
  );

  const scrollHistoryToLatest = async () => {
    await nextTick();
    if (activeTab.value !== "history") return;
    const scroll = historyScroll.value;
    if (scroll) {
      scroll.scrollTop = scroll.scrollHeight;
      lastHistoryScrollTop = scroll.scrollTop;
    }
  };

  const handleHistoryScroll = async () => {
    const scroll = historyScroll.value;
    if (!scroll) return;
    const movingUp = scroll.scrollTop < lastHistoryScrollTop;
    const movingDown = scroll.scrollTop > lastHistoryScrollTop;
    lastHistoryScrollTop = scroll.scrollTop;
    if (loadingHistoryPage) return;
    const older = movingUp && scroll.scrollTop <= 40 && historyStart.value > 0;
    const newer =
      movingDown &&
      scroll.scrollHeight - scroll.clientHeight - scroll.scrollTop <= 40 &&
      historyEnd.value < gameStore.dialogHistory.length;
    if (!older && !newer) return;

    loadingHistoryPage = true;
    const messages = scroll.querySelectorAll<HTMLElement>("[data-history-index]");
    const anchor = older ? messages[0] : messages[messages.length - 1];
    const anchorIndex = anchor?.dataset.historyIndex;
    const previousTop = anchor?.getBoundingClientRect().top ?? 0;
    const previousHeight = scroll.scrollHeight;
    const previousScrollTop = scroll.scrollTop;

    if (older) {
      historyStart.value = Math.max(0, historyStart.value - HISTORY_PAGE_SIZE);
      historyEnd.value = Math.min(historyEnd.value, historyStart.value + MAX_VISIBLE_HISTORY);
    } else {
      historyEnd.value = Math.min(
        gameStore.dialogHistory.length,
        historyEnd.value + HISTORY_PAGE_SIZE
      );
      historyStart.value = Math.max(historyStart.value, historyEnd.value - MAX_VISIBLE_HISTORY);
    }
    await nextTick();
    const newAnchor = anchorIndex
      ? scroll.querySelector<HTMLElement>(`[data-history-index="${anchorIndex}"]`)
      : null;
    scroll.scrollTop = newAnchor
      ? previousScrollTop + newAnchor.getBoundingClientRect().top - previousTop
      : previousScrollTop + scroll.scrollHeight - previousHeight;
    lastHistoryScrollTop = scroll.scrollTop;
    loadingHistoryPage = false;
  };

  watch(activeTab, (tab) => {
    if (tab === "history") {
      historyEnd.value = gameStore.dialogHistory.length;
      historyStart.value = Math.max(0, historyEnd.value - HISTORY_PAGE_SIZE);
      void scrollHistoryToLatest();
    }
  });

  watch(
    () => {
      const history = gameStore.dialogHistory;
      const latest = history[history.length - 1];
      return [history.length, latest?.content, latest?.displayName];
    },
    () => {
      historyEnd.value = gameStore.dialogHistory.length;
      historyStart.value = Math.max(0, historyEnd.value - HISTORY_PAGE_SIZE);
      void scrollHistoryToLatest();
    }
  );

  const loadTodos = async () => {
    const version = ++loadVersion;
    try {
      const data = await getSchedules();
      if (version !== loadVersion) return;
      pendingTodos.value = Object.entries(data.todoGroups ?? {})
        .flatMap(([groupId, group]) =>
          (group.todos ?? [])
            .filter((todo: { completed: boolean }) => !todo.completed)
            .map((todo: { id: number; text: string; priority: number }) => ({
              key: `${groupId}-${todo.id}`,
              text: todo.text,
              priority: Number(todo.priority) || 0,
              groupTitle: group.title || groupId,
            }))
        )
        .sort((a, b) => b.priority - a.priority);
    } catch (error) {
      console.error("加载桌宠待办事项失败:", error);
    }
  };

  onMounted(async () => {
    schedulesUnlisten = await listen(SCHEDULES_CHANGED_EVENT, () => {
      void loadTodos();
    });
    void loadTodos();
  });

  watch(
    () => props.open,
    (open) => {
      if (open) void loadTodos();
    }
  );

  onUnmounted(() => {
    ++loadVersion;
    schedulesUnlisten?.();
  });
</script>

<style scoped>
  .pet-side-panel {
    font-size: max(10px, calc(11px * var(--pet-ui-scale)));
  }

  .pet-side-tab {
    min-width: 0;
    padding: calc(10px * var(--pet-ui-scale)) calc(4px * var(--pet-ui-scale));
    font-weight: 600;
    white-space: nowrap;
    transition: color 200ms;
  }

  .pet-side-page {
    width: 50%;
    flex: 0 0 50%;
    min-width: 0;
    overflow-y: auto;
    padding: calc(12px * var(--pet-ui-scale));
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .pet-side-page::-webkit-scrollbar {
    display: none;
  }
</style>
