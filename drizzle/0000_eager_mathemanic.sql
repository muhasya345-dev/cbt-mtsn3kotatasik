CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`answer_content` text,
	`is_correct` integer,
	`score` real,
	FOREIGN KEY (`exam_session_id`) REFERENCES `exam_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`grade_level` integer NOT NULL,
	`academic_year` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exam_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`semester` text NOT NULL,
	`academic_year` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exam_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`student_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`submitted_at` integer,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`violation_count` integer DEFAULT 0 NOT NULL,
	`time_remaining` integer,
	FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `grades` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`exam_event_id` text NOT NULL,
	`raw_score` real,
	`scaled_score` real,
	`daily_grade` real,
	`final_grade` integer,
	`daily_weight` real DEFAULT 0.5,
	`exam_weight` real DEFAULT 0.5,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exam_event_id`) REFERENCES `exam_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`assignment_id` text NOT NULL,
	`order_number` integer NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`options` text,
	`correct_answer` text,
	`points` real DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`assignment_id`) REFERENCES `teacher_assignments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `room_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`student_id` text NOT NULL,
	`seat_number` integer NOT NULL,
	`participant_number` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`exam_event_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`exam_event_id`) REFERENCES `exam_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_event_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`class_id` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`proctor_user_id` text,
	`token` text,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`exam_event_id`) REFERENCES `exam_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proctor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nis` text NOT NULL,
	`nisn` text,
	`class_id` text NOT NULL,
	`gender` text NOT NULL,
	`birth_place` text,
	`birth_date` text,
	`photo_url` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_nis_unique` ON `students` (`nis`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_nisn_unique` ON `students` (`nisn`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_code_unique` ON `subjects` (`code`);--> statement-breakpoint
CREATE TABLE `teacher_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_event_id` text NOT NULL,
	`teacher_user_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`class_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`exam_event_id`) REFERENCES `exam_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`plain_password` text,
	`role` text NOT NULL,
	`full_name` text NOT NULL,
	`nip` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `violation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_session_id` text NOT NULL,
	`type` text NOT NULL,
	`timestamp` integer NOT NULL,
	`details` text,
	FOREIGN KEY (`exam_session_id`) REFERENCES `exam_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
