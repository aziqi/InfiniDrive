// InfiniDrive  Recursive directory scanner for Windows folder drag-and-drop uploads
export interface ScannedFileItem {
  file: File;
  name: string;
  size: number;
  relativeFolder?: string;
}

/**
 * Recursively scans dropped items or files from Drag and Drop events.
 * Fully supports folder hierarchy, nested subfolders, and accurate file sizes in Chromium/Electron.
 */
export async function scanDataTransferItems(dataTransfer: DataTransfer): Promise<ScannedFileItem[]> {
  const items = dataTransfer.items;
  const results: ScannedFileItem[] = [];

  // Helper to traverse FileSystemEntry (Chromium / Electron)
  async function traverseEntry(entry: any, currentFolder: string): Promise<void> {
    if (!entry) return;

    if (entry.isFile) {
      return new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            results.push({
              file,
              name: file.name,
              size: file.size,
              relativeFolder: currentFolder || undefined
            });
            resolve();
          },
          (err: any) => {
            console.warn('Failed to read file from entry:', entry.name, err);
            resolve();
          }
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const nextFolder = currentFolder ? `${currentFolder}/${entry.name}` : `/${entry.name}`;

      // readEntries must be called iteratively until it returns empty array according to W3C spec
      const readAllEntries = (): Promise<any[]> => {
        return new Promise((resolve) => {
          const allEntries: any[] = [];
          const readBatch = () => {
            dirReader.readEntries(
              (entries: any[]) => {
                if (!entries || entries.length === 0) {
                  resolve(allEntries);
                } else {
                  allEntries.push(...entries);
                  readBatch();
                }
              },
              (err: any) => {
                console.warn('Error reading directory entries:', entry.name, err);
                resolve(allEntries);
              }
            );
          };
          readBatch();
        });
      };

      const entries = await readAllEntries();
      for (const subEntry of entries) {
        await traverseEntry(subEntry, nextFolder);
      }
    }
  }

  if (items && items.length > 0) {
    const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          promises.push(traverseEntry(entry, ''));
        } else {
          const file = item.getAsFile();
          if (file) {
            results.push({
              file,
              name: file.name,
              size: file.size
            });
          }
        }
      }
    }
    await Promise.all(promises);
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      results.push({
        file,
        name: file.name,
        size: file.size
      });
    }
  }

  return results;
}

/**
 * Scans files selected via input[webkitdirectory] or regular input[file]
 */
export function scanSelectedFiles(files: FileList | File[]): ScannedFileItem[] {
  const fileArray = Array.from(files);
  return fileArray.map((file) => {
    let relativeFolder: string | undefined = undefined;
    // webkitRelativePath format: "FolderName/SubFolder/file.ext"
    if ((file as any).webkitRelativePath) {
      const pathParts = (file as any).webkitRelativePath.split('/');
      if (pathParts.length > 1) {
        // Exclude the filename itself from the folder path
        relativeFolder = '/' + pathParts.slice(0, -1).join('/');
      }
    }
    return {
      file,
      name: file.name,
      size: file.size,
      relativeFolder
    };
  });
}
