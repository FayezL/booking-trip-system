export type Profile = {
  id: string;
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  role: "super_admin" | "admin" | "servant" | "patient" | "companion" | "family_assistant";
  has_wheelchair: boolean;
  deleted_at: string | null;
  created_at: string;
};

export type Area = {
  id: string;
  name_ar: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Trip = {
  id: string;
  title_ar: string;
  title_en: string;
  trip_date: string;
  is_open: boolean;
  created_at: string;
};

export type Bus = {
  id: string;
  trip_id: string;
  area_name_ar: string;
  area_name_en: string;
  capacity: number;
  leader_name: string | null;
  area_id: string | null;
  bus_label: string | null;
};

export type Room = {
  id: string;
  trip_id: string;
  room_type: "Male" | "Female";
  capacity: number;
  supervisor_name: string | null;
  room_label: string;
};

export type Booking = {
  id: string;
  user_id: string;
  trip_id: string;
  bus_id: string;
  room_id: string | null;
  created_at: string;
  cancelled_at: string | null;
};

export type AdminLog = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};
