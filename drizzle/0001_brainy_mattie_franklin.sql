ALTER TABLE `exam_events` ADD `participating_class_ids` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `table_capacity` integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `mix_grades` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `sort_mode` text DEFAULT 'class-order' NOT NULL;