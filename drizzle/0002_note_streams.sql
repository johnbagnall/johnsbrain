CREATE TABLE `note_stream` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `note_stream_user_idx` ON `note_stream` (`user_id`);--> statement-breakpoint
ALTER TABLE `note` ADD `stream_id` text REFERENCES note_stream(id);--> statement-breakpoint
ALTER TABLE `note` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `note_stream_idx` ON `note` (`stream_id`);