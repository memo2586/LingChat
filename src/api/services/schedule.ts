import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

export const SCHEDULES_CHANGED_EVENT = "schedules-changed";

export interface ScheduleData {
  scheduleGroups?: Record<string, any>;
  todoGroups?: Record<string, any>;
  importantDays?: any[];
}

export const getSchedules = async (): Promise<ScheduleData> => {
  try {
    const data = await invoke<ScheduleData>("get_schedules");
    return data;
  } catch (error: any) {
    console.error("获取日程信息错误:", error.message);
    throw error;
  }
};

export const saveSchedules = async (data: ScheduleData): Promise<void> => {
  try {
    console.log("日程信息触发提醒");
    await invoke("save_schedules", { data });
    void emit(SCHEDULES_CHANGED_EVENT).catch((error) => {
      console.error("通知日程信息更新失败:", error);
    });
  } catch (error: any) {
    console.error("保存日程信息错误:", error.message);
    throw error;
  }
};

export const reloadProactiveSystem = async (): Promise<void> => {
  try {
    await invoke("reload_proactive_system");
  } catch (error: any) {
    console.error("重载主动系统错误:", error.message);
    throw error;
  }
};
