DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS seats;

CREATE TABLE seats (
  id serial PRIMARY KEY,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'free'
);

CREATE TABLE bookings (
  id serial PRIMARY KEY,
  seat_id int NOT NULL REFERENCES seats(id),
  passenger text NOT NULL,
  created_at timestamptz DEFAULT now()
);
-- deliberately NO unique constraint on bookings.seat_id: the lab must be able to show double-booking
