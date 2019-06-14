'use strict';
/*
Copyright 2019 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

class HTML5FileExplorer {

  /**
   * Create the HTML5FileExplorer app.
   */
  constructor(directoryHandle) {
    this._directoryArray = [];
    this._container = document.querySelector('.file-container-inner');
    this._showDirectory(directoryHandle);
  }

  _getCWD() {
    const lastItem = this._directoryArray.length - 1;
    return this._directoryArray[lastItem];
  }

  _clearFolder() {
    this._container.innerHTML = '';
  }

  _addEntry(entry) {
    const entryContainer = document.createElement('div');
    entryContainer.className = 'entry';
    entryContainer.entry = entry;
    const img = document.createElement('img');
    if (entry.isDirectory) {
      img.src = '/images/ic_folder_black_48dp.svg';
    } else {
      img.src = '/images/ic_insert_drive_file_black_48dp.svg';
    }
    entryContainer.appendChild(img);
    const filename = document.createElement('span');
    filename.textContent = entry.name;
    entryContainer.appendChild(filename);
    // const anchor = document.createElement('a');
    // anchor.href = '#';
    // anchor.className = 'entry';
    // anchor.appendChild(entryContainer);
    // this._container.appendChild(anchor);
    entryContainer.addEventListener('dblclick', () => {
      console.log('dblclick', entryContainer, entryContainer.entry, entry);
      if (entry.isDirectory) {
        this._showDirectory(entry);
      }
    });
    this._container.appendChild(entryContainer);
  }

  async _showDirectory(handle) {
    this._clearFolder();
    this._directoryArray.push(handle);
    const entries = await handle.getEntries();
    for await (const entry of entries) {
      this._addEntry(entry);
    }
  }
}
