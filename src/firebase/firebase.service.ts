import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "fs/promises";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private supabase: SupabaseClient;
  private bucketName = "screenshots";

  constructor(private configService: ConfigService) {
    const supabaseUrl = "https://hakejpynewtzcwgzdsyw.supabase.co";
    const supabaseKey =
      this.configService.get<string>("SUPABASE_KEY") ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhha2VqcHluZXd0emN3Z3pkc3l3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTE0OTU2MywiZXhwIjoyMDUwNzI1NTYzfQ.Rx-dtzaJSA9BJ6NR1M_VLAFCLkKQevKqpfB9lT1cTiM";

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadScreenshot(
    localFilePath: string,
    fileName: string
  ): Promise<string> {
    try {
      const fileBuffer = await readFile(localFilePath);

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(fileName, fileBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const {
        data: { publicUrl },
      } = this.supabase.storage.from(this.bucketName).getPublicUrl(fileName);

      this.logger.log(`Uploaded to Supabase: ${fileName}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`Failed to upload to Supabase: ${fileName}`, error);
      throw error;
    }
  }

  async deleteScreenshot(fileName: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([fileName]);

      if (error) {
        throw error;
      }

      this.logger.log(`Deleted from Supabase: ${fileName}`);
    } catch (error) {
      this.logger.warn(`Failed to delete from Supabase: ${fileName}`, error);
    }
  }

  async deleteOldScreenshots(hoursOld: number = 8): Promise<number> {
    try {
      const { data: files, error } = await this.supabase.storage
        .from(this.bucketName)
        .list();

      if (error) {
        throw error;
      }

      const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000;
      let deletedCount = 0;

      const filesToDelete = files.filter((file) => {
        const createdAt = new Date(file.created_at).getTime();
        return createdAt < cutoffTime;
      });

      if (filesToDelete.length > 0) {
        const fileNames = filesToDelete.map((f) => f.name);
        const { error: deleteError } = await this.supabase.storage
          .from(this.bucketName)
          .remove(fileNames);

        if (!deleteError) {
          deletedCount = filesToDelete.length;
        }
      }

      this.logger.log(`Deleted ${deletedCount} old screenshots from Supabase`);
      return deletedCount;
    } catch (error) {
      this.logger.error("Failed to delete old screenshots", error);
      return 0;
    }
  }

  async deleteAllScreenshots(): Promise<number> {
    try {
      const { data: files, error } = await this.supabase.storage
        .from(this.bucketName)
        .list();

      if (error) {
        throw error;
      }

      if (files.length > 0) {
        const fileNames = files.map((f) => f.name);
        const { error: deleteError } = await this.supabase.storage
          .from(this.bucketName)
          .remove(fileNames);

        if (deleteError) {
          throw deleteError;
        }
      }

      this.logger.log(`Deleted all ${files.length} screenshots from Supabase`);
      return files.length;
    } catch (error) {
      this.logger.error("Failed to delete all screenshots", error);
      return 0;
    }
  }
}
