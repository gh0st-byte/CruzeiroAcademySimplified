import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MigrationRunner {
  constructor() {
    this.migrationsDir = join(__dirname, 'sql');
  }

  async ensureMigrationTable() {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          version VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(500) NOT NULL,
          executed_at TIMESTAMP NOT NULL DEFAULT NOW(),
          execution_time_ms INTEGER,
          checksum VARCHAR(64)
        )
      `);
      
      logger.info('Migration table ensured');
    } catch (error) {
      logger.error('Failed to ensure migration table:', error);
      throw error;
    }
  }

  async getExecutedMigrations() {
    try {
      const result = await db.query(`
        SELECT version FROM schema_migrations ORDER BY version
      `);
      return result.rows.map(row => row.version);
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      throw error;
    }
  }

  async getMigrationFiles() {
    try {
      const files = await readdir(this.migrationsDir);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort()
        .map(file => {
          const match = file.match(/^(\d{14})_(.+)\.sql$/);
          if (!match) {
            throw new Error(`Invalid migration file format: ${file}`);
          }
          return {
            version: match[1],
            name: match[2].replace(/_/g, ' '),
            filename: file,
            path: join(this.migrationsDir, file)
          };
        });
    } catch (error) {
      logger.error('Failed to read migration files:', error);
      throw error;
    }
  }

  async calculateChecksum(content) {
    const crypto = await import('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async executeMigration(migration) {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing migration: ${migration.version}_${migration.name}`);
      
      // Ler conteúdo do arquivo
      const content = await readFile(migration.path, 'utf8');
      const checksum = await this.calculateChecksum(content);
      
      // Executar migration em transação
      await db.transaction(async (client) => {
        // Executar SQL da migration
        await client.query(content);
        
        // Registrar execução
        const executionTime = Date.now() - startTime;
        await client.query(`
          INSERT INTO schema_migrations (version, name, execution_time_ms, checksum)
          VALUES ($1, $2, $3, $4)
        `, [migration.version, migration.name, executionTime, checksum]);
        
        logger.info(`Migration ${migration.version} executed successfully in ${executionTime}ms`);
      });
      
      return { success: true, executionTime: Date.now() - startTime };
    } catch (error) {
      logger.error(`Migration ${migration.version} failed:`, error);
      throw error;
    }
  }

  async runMigrations(options = {}) {
    const { dryRun = false, targetVersion = null } = options;
    
    try {
      await db.initialize();
      await this.ensureMigrationTable();
      
      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = await this.getMigrationFiles();
      
      const pendingMigrations = availableMigrations.filter(migration => {
        if (targetVersion && migration.version > targetVersion) {
          return false;
        }
        return !executedMigrations.includes(migration.version);
      });
      
      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations found');
        return {
          success: true,
          executed: [],
          message: 'Database is up to date'
        };
      }
      
      logger.info(`Found ${pendingMigrations.length} pending migrations`);
      
      if (dryRun) {
        logger.info('Dry run mode - would execute:');
        pendingMigrations.forEach(m => {
          logger.info(`  - ${m.version}_${m.name}`);
        });
        return {
          success: true,
          dryRun: true,
          pendingMigrations: pendingMigrations.map(m => `${m.version}_${m.name}`)
        };
      }
      
      const executedResults = [];
      
      for (const migration of pendingMigrations) {
        const result = await this.executeMigration(migration);
        executedResults.push({
          version: migration.version,
          name: migration.name,
          ...result
        });
      }
      
      logger.info(`Successfully executed ${executedResults.length} migrations`);
      
      return {
        success: true,
        executed: executedResults,
        message: `Executed ${executedResults.length} migrations successfully`
      };
      
    } catch (error) {
      logger.error('Migration execution failed:', error);
      throw error;
    }
  }

  async rollbackMigration(version) {
    try {
      // Verificar se migration foi executada
      const migrationResult = await db.query(`
        SELECT * FROM schema_migrations WHERE version = $1
      `, [version]);
      
      if (migrationResult.rows.length === 0) {
        throw new Error(`Migration ${version} was not executed`);
      }
      
      // Procurar arquivo de rollback
      const rollbackFile = join(this.migrationsDir, 'rollbacks', `${version}_rollback.sql`);
      
      try {
        const rollbackContent = await readFile(rollbackFile, 'utf8');
        
        await db.transaction(async (client) => {
          // Executar rollback
          await client.query(rollbackContent);
          
          // Remover registro da migration
          await client.query(`
            DELETE FROM schema_migrations WHERE version = $1
          `, [version]);
        });
        
        logger.info(`Rollback for migration ${version} executed successfully`);
        return { success: true };
        
      } catch (fileError) {
        throw new Error(`Rollback file not found for migration ${version}`);
      }
    } catch (error) {
      logger.error(`Rollback failed for migration ${version}:`, error);
      throw error;
    }
  }

  async getMigrationStatus() {
    try {
      await this.ensureMigrationTable();
      
      const executed = await this.getExecutedMigrations();
      const available = await this.getMigrationFiles();
      
      const pending = available.filter(m => !executed.includes(m.version));
      
      const executedDetails = await db.query(`
        SELECT version, name, executed_at, execution_time_ms
        FROM schema_migrations
        ORDER BY version DESC
        LIMIT 10
      `);
      
      return {
        database: {
          connected: true,
          totalExecuted: executed.length,
          totalAvailable: available.length,
          totalPending: pending.length
        },
        lastExecuted: executedDetails.rows,
        pendingMigrations: pending.map(m => ({
          version: m.version,
          name: m.name,
          filename: m.filename
        }))
      };
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    }
  }
}

// CLI Interface
const migrationRunner = new MigrationRunner();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    switch (command) {
      case 'up':
        const upOptions = {
          dryRun: args.includes('--dry-run'),
          targetVersion: args.find(arg => arg.startsWith('--target='))?.split('=')[1]
        };
        const upResult = await migrationRunner.runMigrations(upOptions);
        console.log(JSON.stringify(upResult, null, 2));
        break;
        
      case 'status':
        const status = await migrationRunner.getMigrationStatus();
        console.log(JSON.stringify(status, null, 2));
        break;
        
      case 'rollback':
        const version = args[1];
        if (!version) {
          throw new Error('Version required for rollback');
        }
        const rollbackResult = await migrationRunner.rollbackMigration(version);
        console.log(JSON.stringify(rollbackResult, null, 2));
        break;
        
      default:
        console.log('Usage:');
        console.log('  node run-migrations.js up [--dry-run] [--target=VERSION]');
        console.log('  node run-migrations.js status');
        console.log('  node run-migrations.js rollback VERSION');
        process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    logger.error('Migration CLI error:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Se executado diretamente, rodar CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MigrationRunner;
