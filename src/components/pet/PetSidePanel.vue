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
                wrap-break-word whitespace-pre-wrap last:border-b-0"
            >
              {{ todo.text }}
            </li>
          </ul>
        </div>

        <div class="pet-side-page" role="tabpanel">
          <p v-if="historyMessages.length === 0" class="text-white/55">
            {{ $t("pet.history.empty") }}
          </p>
          <div v-else class="space-y-[calc(8px*var(--pet-ui-scale))]">
            <div
              v-for="(message, index) in historyMessages"
              :key="index"
              class="flex min-w-0 items-start leading-relaxed"
            >
              <span class="max-w-[42%] shrink-0 wrap-break-word text-cyan-300">
                {{ message.displayName }}:
              </span>
              <span class="min-w-0 flex-1 wrap-break-word whitespace-pre-wrap">
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
  import { computed, onMounted, onUnmounted, ref, watch } from "vue";
  import { useI18n } from "vue-i18n";

  const props = defineProps<{ open: boolean }>();
  const gameStore = useGameStore();
  const { t } = useI18n();
  const activeTab = ref<"todo" | "history">("todo");
  const pendingTodos = ref<{ key: string; text: string }[]>([]);
  let schedulesUnlisten: (() => void) | null = null;
  let loadVersion = 0;

  const historyMessages = computed(() =>
    gameStore.dialogHistory
      .filter((message) => message.content.trim() !== "")
      .map((message) => ({
        displayName:
          message.displayName ||
          (message.type === "message"
            ? gameStore.userName || t("pet.history.you")
            : t("pet.history.mysteryVoice")),
        content: message.content,
      }))
  );

  const loadTodos = async () => {
    const version = ++loadVersion;
    try {
      const data = await getSchedules();
      if (version !== loadVersion) return;
      pendingTodos.value = Object.entries(data.todoGroups ?? {}).flatMap(([groupId, group]) =>
        (group.todos ?? [])
          .filter((todo: { completed: boolean }) => !todo.completed)
          .map((todo: { id: number; text: string }) => ({
            key: `${groupId}-${todo.id}`,
            text: todo.text,
          }))
      );
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
    scrollbar-width: thin;
  }
</style>
