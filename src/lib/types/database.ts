export type Sector = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type Profile = {
  id: string;
  phone: string;
  full_name: string;
  gender: "Male" | "Female";
  role: "super_admin" | "admin" | "servant" | "patient" | "companion" | "family_assistant";
  has_wheelchair: boolean;
  sector_id: string | null;
  has_car: boolean;
  car_seats: number | null;
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

export type Car = {
  id: string;
  trip_id: string;
  driver_id: string | null;
  capacity: number;
  car_label: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  user_id: string;
  trip_id: string;
  bus_id: string | null;
  room_id: string | null;
  car_id: string | null;
  companion_count: number;
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
