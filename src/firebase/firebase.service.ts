import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile } from "fs/promises";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private supabase: SupabaseClient | null = null;
  private bucketName = "screenshots";
  private isEnabled = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    this.logger.log("========================================");
    this.logger.log("☁️ Initializing Firebase/Supabase Service...");

    try {
      const supabaseUrl =
        this.configService.get<string>("SUPABASE_URL") ||
        "https://hakejpynewtzcwgzdsyw.supabase.co";
      const supabaseKey = this.configService.get<string>("SUPABASE_KEY");

      if (!supabaseKey) {
        this.logger.warn("⚠️ SUPABASE_KEY not configured");
        this.logger.warn(
          "⚠️ Cloud storage disabled - using local storage only"
        );
        this.logger.log("========================================");
        return;
      }

      this.logger.log(`📡 Supabase URL: ${supabaseUrl}`);
      this.logger.log(`🔑 Supabase Key: ${supabaseKey.substring(0, 20)}...`);

      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
        },
      });

      // Test connection
      const { data, error } = await this.supabase.storage.listBuckets();

      if (error) {
        throw error;
      }

      this.isEnabled = true;
      this.logger.log("✅ Supabase connected successfully");
      this.logger.log(`📦 Available buckets: ${data?.length || 0}`);
      this.logger.log(`🎯 Target bucket: ${this.bucketName}`);

      // Check if bucket exists
      const bucketExists = data?.some((b) => b.name === this.bucketName);
      if (bucketExists) {
        this.logger.log("✅ Screenshots bucket found");
      } else {
        this.logger.warn("⚠️ Screenshots bucket not found");
      }

      this.logger.log("========================================");
    } catch (error) {
      this.logger.error("========================================");
      this.logger.error("❌ Failed to initialize Supabase");
      this.logger.error(`Error: ${error.message}`);
      this.logger.error(`Code: ${error.code || "N/A"}`);
      this.logger.error("========================================");
      this.logger.error("Possible causes:");
      this.logger.error("1. SUPABASE_KEY is invalid");
      this.logger.error("2. Network connectivity issues");
      this.logger.error("3. Supabase service is down");
      this.logger.error("4. Firewall blocking connection");
      this.logger.error("========================================");
      this.logger.warn("⚠️ Continuing without cloud storage");
      this.logger.warn("⚠️ Screenshots will be stored locally only");
      this.logger.log("========================================");
      this.isEnabled = false;
    }
  }

  async uploadScreenshot(
    localFilePath: string,
    fileName: string
  ): Promise<string | null> {
    if (!this.isEnabled || !this.supabase) {
      this.logger.debug("⏭️ Supabase disabled, skipping upload");
      return null;
    }

    try {
      this.logger.debug(`📤 Uploading to Supabase: ${fileName}`);
      const fileBuffer = await readFile(localFilePath);

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(fileName, fileBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (error) {
        this.logger.error(`❌ Supabase upload error: ${error.message}`);
        throw error;
      }

      const {
        data: { publicUrl },
      } = this.supabase.storage.from(this.bucketName).getPublicUrl(fileName);

      this.logger.log(`✅ Uploaded to Supabase: ${fileName}`);
      return publicUrl;
    } catch (error) {
      this.logger.error(`❌ Failed to upload to Supabase: ${fileName}`);
      this.logger.error(`Error: ${error.message}`);
      this.logger.warn("⚠️ Continuing with local file");
      return null;
    }
  }

  async deleteScreenshot(fileName: string): Promise<void> {
    if (!this.isEnabled || !this.supabase) {
      this.logger.debug("⏭️ Supabase disabled, skipping deletion");
      return;
    }

    try {
      this.logger.debug(`🗑️ Deleting from Supabase: ${fileName}`);

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .remove([fileName]);

      if (error) {
        this.logger.warn(`⚠️ Supabase delete error: ${error.message}`);
        return;
      }

      this.logger.debug(`✅ Deleted from Supabase: ${fileName}`);
    } catch (error) {
      this.logger.warn(`⚠️ Failed to delete from Supabase: ${fileName}`);
      this.logger.debug(`Error: ${error.message}`);
    }
  }

  async deleteOldScreenshots(hoursOld: number = 8): Promise<number> {
    if (!this.isEnabled || !this.supabase) {
      this.logger.debug("⏭️ Supabase disabled, skipping cleanup");
      return 0;
    }

    try {
      this.logger.log(
        `🧹 Checking for screenshots older than ${hoursOld} hours...`
      );

      const { data: files, error } = await this.supabase.storage
        .from(this.bucketName)
        .list();

      if (error) {
        this.logger.error(`❌ Failed to list files: ${error.message}`);
        throw error;
      }

      this.logger.log(`📁 Found ${files?.length || 0} total files in Supabase`);

      const cutoffTime = Date.now() - hoursOld * 60 * 60 * 1000;
      let deletedCount = 0;

      const filesToDelete =
        files?.filter((file) => {
          const createdAt = new Date(file.created_at).getTime();
          return createdAt < cutoffTime;
        }) || [];

      this.logger.log(`🗑️ Found ${filesToDelete.length} old files to delete`);

      if (filesToDelete.length > 0) {
        const fileNames = filesToDelete.map((f) => f.name);
        const { error: deleteError } = await this.supabase.storage
          .from(this.bucketName)
          .remove(fileNames);

        if (deleteError) {
          this.logger.error(`❌ Delete error: ${deleteError.message}`);
        } else {
          deletedCount = filesToDelete.length;
          this.logger.log(
            `✅ Deleted ${deletedCount} old screenshots from Supabase`
          );
        }
      } else {
        this.logger.log("✅ No old screenshots to delete");
      }

      return deletedCount;
    } catch (error) {
      this.logger.error("========================================");
      this.logger.error("❌ Failed to delete old screenshots");
      this.logger.error(`Error: ${error.message}`);
      this.logger.error(`Error name: ${error.name}`);

      if (error.message?.includes("fetch failed")) {
        this.logger.error("========================================");
        this.logger.error("🌐 Network Error Detected");
        this.logger.error("Possible causes:");
        this.logger.error("1. No internet connection");
        this.logger.error("2. Supabase service is down");
        this.logger.error("3. Firewall blocking connection");
        this.logger.error("4. DNS resolution failed");
        this.logger.error("========================================");
        this.logger.error("💡 Recommendation:");
        this.logger.error("- Check internet connection");
        this.logger.error(
          "- Test: curl https://hakejpynewtzcwgzdsyw.supabase.co"
        );
        this.logger.error("- Or disable Supabase by removing SUPABASE_KEY");
        this.logger.error("========================================");
      }

      return 0;
    }
  }

  async deleteAllScreenshots(): Promise<number> {
    if (!this.isEnabled || !this.supabase) {
      this.logger.debug("⏭️ Supabase disabled, skipping deletion");
      return 0;
    }

    try {
      this.logger.log("🗑️ Deleting all screenshots from Supabase...");

      const { data: files, error } = await this.supabase.storage
        .from(this.bucketName)
        .list();

      if (error) {
        this.logger.error(`❌ Failed to list files: ${error.message}`);
        throw error;
      }

      this.logger.log(`📁 Found ${files?.length || 0} files`);

      if (files && files.length > 0) {
        const fileNames = files.map((f) => f.name);
        const { error: deleteError } = await this.supabase.storage
          .from(this.bucketName)
          .remove(fileNames);

        if (deleteError) {
          this.logger.error(`❌ Delete error: ${deleteError.message}`);
          throw deleteError;
        }

        this.logger.log(
          `✅ Deleted all ${files.length} screenshots from Supabase`
        );
        return files.length;
      }

      this.logger.log("✅ No screenshots to delete");
      return 0;
    } catch (error) {
      this.logger.error("❌ Failed to delete all screenshots");
      this.logger.error(`Error: ${error.message}`);
      return 0;
    }
  }

  isSupabaseEnabled(): boolean {
    return this.isEnabled;
  }
}
