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
  role: "super_admin" | "admin" | "servant" | "patient" | "companion" | "family_assistant" | "trainee";
  has_wheelchair: boolean;
  sector_id: string | null;
  has_car: boolean;
  car_seats: number | null;
  transport_type: "private" | "bus";
  servants_needed: 0 | 1 | 2;
  deleted_at: string | null;
  created_at: string;
};

export type UserDetail = {
  id: string;
  phone: string;
  full_name: string;
  gender: string;
  role: string;
  has_wheelchair: boolean;
  transport_type: string;
  servants_needed: number;
  sector_name: string;
  has_car: boolean;
  car_seats: number | null;
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

export type FamilyMember = {
  id: string;
  head_user_id: string;
  full_name: string;
  gender: "Male" | "Female";
  has_wheelchair: boolean;
  created_at: string;
};

export type Booking = {
  id: string;
  user_id: string;
  trip_id: string;
  bus_id: string | null;
  room_id: string | null;
  car_id: string | null;
  family_member_id: string | null;
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

export type TripStats = {
  trip_id: string;
  title_ar: string;
  title_en: string;
  trip_date: string;
  is_open: boolean;
  total_booked: number;
  total_registered: number;
  by_role: Record<string, number>;
  by_gender: { Male: number; Female: number };
  by_transport: Record<string, number>;
  wheelchair_count: number;
  family_members_count: number;
  by_sector: { name: string; count: number }[];
  transport_breakdown: { on_bus: number; in_car: number; no_transport: number };
  servants_needed: Record<string, number>;
  bus_stats: { total_seats: number; filled: number };
  room_stats: { total_capacity: number; assigned: number };
};
