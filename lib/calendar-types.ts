export type CalendarItem = {
  id: string;
  kind: "lead" | "project" | "task" | "booking" | "finance";
  title: string;
  client: string;
  status: string;
  due_date: string;
};

export type Deliverable = {
  id: string;
  project_id: string;
  title: string;
  due_date: string;
  status: "Planned" | "In progress" | "Done";
  notes: string;
  project_title: string;
  project_client: string;
  project_status: string;
  created_at: number;
  updated_at: number;
};
