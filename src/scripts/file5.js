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
   *
   * @see https://wicg.github.io/native-file-system/
   * @see https://github.com/WICG/native-file-system/blob/master/EXPLAINER.md
   *
   */
  constructor(handle) {
    this._cwd = handle;
    this._history = {
      back: [],
      forward: [],
    };
    this._path = `/${handle.name}`;
    this._settings = {
      hideHidden: true,
    };
    this._depth = 0;
    this._entries = [];

    // Set the current history
    history.replaceState({depth: this._depth}, null, `#!/${handle.name}`);

    this._worker = new Worker('/scripts/worker.js');
    this._worker.addEventListener('message', (e) => {
      console.log('Message from worker:', e.data);
    });
    this._worker.addEventListener('error', (err) => {
      console.error('Error from worker', err);
    });
    try {
      this._worker.postMessage({handle: handle});
    } catch (ex) {
      // https://bugs.chromium.org/p/chromium/issues/detail?id=955192
      // console.warn('Unable to postMessage handle to worker', ex);
    }

    // Find & cache the key elements we'll need
    this._footer = document.getElementById('footer');
    this._headerText = document.querySelector('header h1');
    this._container = document.querySelector('.file-container-inner');
    this._previewContainer = document.getElementById('preview-container');
    this._previewTitle = document.querySelector('#dialogPreview .dialog-title');
    this._infoContainer = document.getElementById('info-container');
    this._infoTitle = document.querySelector('#dialogInfo .dialog-title');
    this._backButton = document.getElementById('butBack');
    this._forwardButton = document.getElementById('butForward');

    // Close the start dialog & render the current directory
    this._showDialog('dialogStart', false);

    // Check to see if we have write permissions for the root.
    this._checkPermissions();

    // Draw the initial contents;
    this._renderDirectory();

    // Hook up the back & forward buttons, and history
    this._backButton.addEventListener('click', () => {
      window.history.back();
    });
    this._forwardButton.addEventListener('click', () => {
      window.history.forward();
    });
    window.addEventListener('popstate', (e) => {
      this._handlePopState(e);
    });

    // Hook up the refresh button
    const butRefresh = document.getElementById('butRefresh');
    butRefresh.addEventListener('click', () => {
      this._renderDirectory();
    });

    // Hook up the help button
    const butHelp = document.getElementById('butHelp');
    butHelp.addEventListener('click', () => {
      this._showDialog('dialogAbout', true);
    });

    // Listen for key strokes
    document.addEventListener('keydown', (e) => {
      this._handleKeystroke(e);
    });

    // Listen for clicks on the document body & clear selected item.
    document.addEventListener('click', (e) => {
      this._clearSelected();
    });

    // Setup the DnD listeners for file drop.
    document.body.addEventListener('dragenter', (e) => {
      this._handleDragEnter(e);
    });

    document.body.addEventListener('dragover', (e) => {
      this._handleDragOver(e);
    });

    document.body.addEventListener('dragleave', (e) => {
      this._handleDragLeave(e);
    });

    document.body.addEventListener('drop', (e) => {
      this._handleDrop(e);
    });

    this._initDialogs();
  }

  // **************************************************************
  // Drag and Drop handlers
  // **************************************************************

  _handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    console.log('drop');
    this._handleDroppedFiles(e.dataTransfer.files);
    document.body.classList.remove('dropping');
  }

  _handleDragLeave(e) {
    // TODO: Fix this.
    document.body.classList.remove('dropping');
    console.log('drag-leave');
  }

  _handleDragEnter(e) {
    e.stopPropagation();
    e.preventDefault();
    console.log('drag-enter');
    document.body.classList.add('dropping');
  }

  _handleDragOver(e) {
    e.stopPropagation();
    e.preventDefault();
    console.log('drag-over');
    e.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
  }

  async _handleDroppedFiles(files) {
    const cwd = this._cwd;
    for await (const file of files) {
      await this._addDroppedFile(file);
    }
  }

  // **************************************************************
  // Permissions
  // **************************************************************

  async _checkPermissions() {
    let value = await this._hasWritePermission();
    if (value === 'prompt') {
      value = await this._requestWritePermission();
    }
    console.log(`Permission for ${this._cwd.name} is '${value}'`);
  }

  async _hasWritePermission(entry) {
    entry = entry || this._cwd;
    if (!entry.queryPermission) {
      return null;
    }
    return await entry.queryPermission({writable: true});
  }

  async _requestWritePermission(entry) {
    entry = entry || this._cwd;
    if (!entry.requestPermission) {
      return null;
    }
    return await entry.requestPermission({writable: true});
  }

  // **************************************************************
  // History & Pop State
  // **************************************************************

  _handlePopState(e) {
    const curDepth = this._depth;
    const newDepth = e.state.depth;
    if (newDepth < curDepth) {
      this._navBack();
    } else if (newDepth > curDepth) {
      this._navForward();
    }
  }

  _navBack() {
    if (this._history.back.length === 0) {
      return;
    }
    this._history.forward.push(this._cwd);
    this._cwd = this._history.back.pop();
    this._depth--;
    this._path = this._path.substr(0, this._path.lastIndexOf('/'));
    this._renderDirectory();
  }

  _navForward() {
    if (this._history.forward.length === 0) {
      return;
    }
    this._history.back.push(this._cwd);
    this._cwd = this._history.forward.pop();
    this._depth++;
    this._path += `/${this._cwd.name}`;
    this._renderDirectory();
  }

  _navOpen(newDir) {
    this._history.back.push(this._cwd);
    this._history.forward = [];
    this._cwd = newDir;
    this._depth++;
    this._path += `/${newDir.name}`;
    this._renderDirectory();
    history.pushState({depth: this._depth}, null, `#!${this._path}`);
  }

  // **************************************************************
  // TBD
  // **************************************************************

  _itemsPerRow(item, container) {
    const itemWidth = item.offsetWidth;
    const containerWidth = container.offsetWidth;
    const itemsPerRow = Math.floor(containerWidth / itemWidth);
    return itemsPerRow;
  }

  _handleKeystroke(e) {
    const key = e.key;
    const keyCode = e.keyCode;

    // TODO: Handle CTRL-N: Create new directory
    if ((e.ctrlKey && key === 'n') || (e.metaKey && key === 'n')) {
      e.preventDefault();
      this._createDirectory();
      return;
    }

    if ((e.ctrlKey && key === 'i') || (e.metaKey && key === 'i')) {
      e.preventDefault();
      this._showInfo();
      return;
    }

    // Rename entry if only 1 is selected
    if ((key === 'Enter') || (e.metaKey && key === 'ArrowDown')) {
      e.preventDefault();
      const selectedElems = this._getSelectedItems();
      if (selectedElems.length === 1) {
        this._makeFilenameEditable(selectedElems[0]);
      }
      return;
    }

    // Arrow keys
    if (keyCode >= 37 && keyCode <= 40) {
      e.preventDefault();
      let newElem = null;
      const selectedElems = this._getSelectedItems();
      if (selectedElems.length === 0) {
        newElem = this._container.firstChild;
      } else if (selectedElems.length === 1) {
        const curElem = selectedElems[0];
        if (key === 'ArrowRight') {
          newElem = curElem.nextSibling;
        } else if (key === 'ArrowLeft') {
          newElem = curElem.previousSibling;
        } else if (key === 'ArrowDown') {
          const itemsPerRow = this._itemsPerRow(curElem, this._container);
          newElem = curElem;
          for (let i = 0; i < itemsPerRow; i++) {
            if (newElem.nextSibling) {
              newElem = newElem.nextSibling;
            }
          }
        } else {
          const itemsPerRow = this._itemsPerRow(curElem, this._container);
          newElem = curElem;
          for (let i = 0; i < itemsPerRow; i++) {
            if (newElem.previousSibling) {
              newElem = newElem.previousSibling;
            }
          }
        }
      }
      if (newElem) {
        this._selectItem(newElem);
      }
      return;
    }

    // Delete file
    if (key === 'Delete') {
      e.preventDefault();
      this._deleteFiles();
      return;
    }

    // Refresh directory (WIN/APPLE+r)
    if (e.metaKey && key === 'r') {
      e.preventDefault();
      this._renderDirectory();
      return;
    }

    // console.log('_handleKeystroke', key, keyCode, e);
  }



  // **************************************************************
  // Dialog Helpers
  // **************************************************************

  _showDialog(id, visible) {
    const container = document.getElementById('dialogContainer');
    const dialog = document.getElementById(id);
    container.classList.toggle('hidden', !visible);
    dialog.classList.toggle('hidden', !visible);
  }

  _initDialogs() {
    const about = document.getElementById('dialogAbout');
    about.querySelector('.close').addEventListener('click', () => {
      this._showDialog('dialogAbout', false);
    });
    const preview = document.getElementById('dialogPreview');
    preview.querySelector('.close').addEventListener('click', () => {
      this._showDialog('dialogPreview', false);
    });
    const info = document.getElementById('dialogInfo');
    info.querySelector('.close').addEventListener('click', () => {
      this._showDialog('dialogInfo', false);
    });
  }

  // **************************************************************
  // Render contents of a directory
  // **************************************************************

  _clearFolder() {
    const inner = document.createElement('div');
    inner.className = 'file-container-inner';
    this._container.replaceWith(inner);
    this._container = inner;
    this._entries = [];
  }

  async _renderDirectory() {
    this._clearFolder();
    this._headerText.textContent = this._cwd.name;
    this._footer.textContent = this._path;
    const entries = await this._cwd.getEntries();
    // TODO: does this need to be await?
    for await (const entry of entries) {
      const elem = this._createElemEntry(entry);
      this._addEntryAndElem(entry, elem);
    }
    this._updateBackForward();
  }

  _addEntryAndElem(entry, elem) {
    const val = this._entries.push(entry);
    elem.dataset.entryId = val - 1;
    this._container.appendChild(elem);
  }

  _createElemEntry(entry) {
    // Create the main div container
    const entryContainer = document.createElement('div');
    const entryContainerClasses = ['entry'];
    entryContainer.setAttribute('draggable', true);
    entryContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      this._selectItem(entryContainer);
    });
    entryContainer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (entry.isDirectory) {
        return this._navOpen(entry);
      }
      return this._previewFile(entry);
    });
    if (entry.name.startsWith('.')) {
      entryContainerClasses.push('hiddenFile');
    }

    // Create the icon
    const img = document.createElement('img');
    if (entry.isDirectory) {
      img.src = '/images/ic_folder_black_48dp.svg';
    } else {
      img.src = '/images/ic_insert_drive_file_black_48dp.svg';
    }

    // Create the filename element
    const filename = document.createElement('span');
    filename.textContent = entry.name;
    filename.addEventListener('click', () => {
      if (entryContainer.classList.contains('selected')) {
        this._makeFilenameEditable(entryContainer);
      }
    });
    filename.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const keyCode = e.keyCode;
      if (keyCode === 13 || keyCode === 27) {
        e.preventDefault();
        if (keyCode === 27) {
          this._updateEntryElement(entryContainer);
          return;
        }
        this._renameEntry(entryContainer);
      }
    });

    // Build the element
    entryContainer.className = entryContainerClasses.join(' ');
    entryContainer.appendChild(img);
    entryContainer.appendChild(filename);
    return entryContainer;
  }

  // **************************************************************
  // Helpers to update UI elements
  // **************************************************************

  _updateEntryElement(elem) {
    const handleId = elem.dataset.entryId;
    const handle = this._entries[handleId];
    const filenameElem = elem.querySelector('span');
    filenameElem.removeAttribute('contenteditable');
    filenameElem.textContent = handle.name;
  }

  _updateBackForward() {
    if (this._history.back.length > 0) {
      this._backButton.removeAttribute('disabled');
    } else {
      this._backButton.setAttribute('disabled', true);
    }
    if (this._history.forward.length > 0) {
      this._forwardButton.removeAttribute('disabled');
    } else {
      this._forwardButton.setAttribute('disabled', true);
    }
  }


  // **************************************************************
  // Helpers for selected elements
  // **************************************************************

  _getSelectedItems() {
    return document.querySelectorAll('.entry.selected');
  }

  _clearSelected() {
    this._getSelectedItems().forEach((e) => {
      e.classList.remove('selected');
    });
  }

  _selectItem(elem) {
    this._clearSelected();
    if (elem) {
      elem.classList.add('selected');
    }
  }

  // **************************************************************
  // Add Dropped File
  // **************************************************************

  async _addDroppedFile(file) {
    // TODO: Support directories being dropped.
    if (file.type === '' || !file.type) {
      console.warn(`Dragged file has no type, directory?`, file);
      return;
    }
    const createFileOpts = {create: true, exclusive: true};
    const fileName = await this._getSafeEntryName(file.name);
    try {
      const entry = await this._cwd.getFile(fileName, createFileOpts);
      const writer = await entry.createWriter();
      await writer.write(0, file);
      await writer.close();
      const elem = this._createElemEntry(entry);
      this._addEntryAndElem(entry, elem);
    } catch (ex) {
      console.error(`Drop failed for ${file.name}`, ex);
    }
  }

  // **************************************************************
  // Rename
  // **************************************************************

  _makeFilenameEditable(elem) {
    const filenameElem = elem.querySelector('span');
    filenameElem.setAttribute('contenteditable', true);
    filenameElem.setAttribute('spellcheck', false);
    filenameElem.focus();
  }

  async _renameEntry(elem) {
    const handleId = elem.dataset.entryId;
    const handle = this._entries[handleId];
    const filenameElem = elem.querySelector('span');
    const newName = filenameElem.textContent;

    // Filename hasn't changed, ignore
    if (newName === handle.name) {
      return;
    }

    const alreadyExists = await this._doesExist(newName);
    if (alreadyExists) {
      console.warn(`RENAME failed: '${newName}' already exists.`);
    } else {
      try {
        const newHandle = await handle.moveTo(this._cwd, newName);
        this._entries[handleId] = newHandle;
      } catch (ex) {
        console.error(`RENAME failed: ${handle.name} -> ${newName}`, ex);
      }
    }
    this._updateEntryElement(elem);
  }

  // **************************************************************
  // Create a directory
  // **************************************************************

  async _doesExist(filename) {
    const f = await this._doesFileExist(filename);
    const d = await this._doesDirectoryExist(filename);
    if (f || d) {
      return true;
    }
    return false;
  }

  async _doesFileExist(filename) {
    try {
      // Try to get the file/directory.
      await this._cwd.getFile(filename);
      return true;
    } catch (ex) {
      return false;
    }
  }

  async _doesDirectoryExist(dirName) {
    try {
      // Try to get the file/directory.
      await this._cwd.getDirectory(dirName);
      return true;
    } catch (ex) {
      return false;
    }
  }

  async _getSafeEntryName(preferredName, counter) {
    // Setup the defaults
    preferredName = preferredName || 'Untitled';
    counter = counter || 0;

    // Setup place holders
    let fileName = preferredName;
    let fileExt;

    // Separate out the extension if it exists. Includes special handling
    // for files that START with a dot.
    const lastIndexOfDot = fileName.lastIndexOf('.');
    if (lastIndexOfDot > 0) {
      fileExt = preferredName.substr(lastIndexOfDot + 1);
      fileName = preferredName.substr(0, lastIndexOfDot);
    }

    // Build the file name into result
    let result = fileName;
    if (counter) {
      result += ` (${counter})`;
    }
    if (fileExt) {
      result += `.${fileExt}`;
    }
    // check if the file exists
    if (await this._doesExist(result)) {
      return await this._getSafeEntryName(preferredName, ++counter);
    }
    return result;
  }

  async _createDirectory() {
    const createOpts = {create: true, exclusive: true};
    const dirName = await this._getSafeEntryName('Untitled');
    const newDir = await this._cwd.getDirectory(dirName, createOpts);
    const elem = this._createElemEntry(newDir);
    this._addEntryAndElem(newDir, elem);
    this._selectItem(elem);
    this._makeFilenameEditable(elem);
  }

  // **************************************************************
  // Delete a file
  // **************************************************************

  async _deleteFiles() {
    const elems = this._getSelectedItems();
    if (elems.length === 0) {
      return;
    }
    const fileNames = [];
    elems.forEach((elem) => {
      const entryId = elem.dataset.entryId;
      const entry = this._entries[entryId];
      fileNames.push(entry.name);
    });
    if (window.confirm(`Delete files [${fileNames.join(',')}]?`)) {
      const promises = [];
      elems.forEach(async (elem) => {
        const entryId = elem.dataset.entryId;
        const entry = this._entries[entryId];
        if (entry.isFile) {
          try {
            await entry.remove();
            this._container.removeChild(elem);
          } catch (ex) {
            log.error(`DELETE failed for: ${entry.name}`, ex);
          }
        } else {
          try {
            await entry.removeRecursively();
            this._container.removeChild(elem);
          } catch (ex) {
            log.error(`DELETE failed for ${entry.name}`, ex);
          }
        }
      });
    } else {
      this._clearSelected();
    }
  }

  // **************************************************************
  // Show File Info
  // **************************************************************

  async _showInfo() {
    const elems = this._getSelectedItems();
    if (elems.length !== 1) {
      return;
    }
    const elem = elems[0];
    const entryId = elem.dataset.entryId;
    const entry = this._entries[entryId];
    this._infoTitle.textContent = entry.name;
    if (entry.isFile) {
      this._showFileInfo(await entry.getFile());
    } else {
      this._showDirectoryInfo(entry);
    }
  }

  async _showFileInfo(handle) {
    const values = [];
    console.log('File Info', handle);
    values.push({label: 'Kind', value: handle.type});
    values.push({label: 'Size', value: handle.size});
    values.push({label: 'Where', value: this._path});
    values.push({label: 'Last Modified', value: handle.lastModifiedDate});
    this._showInfoDialog(values);
  }

  async _showDirectoryInfo(handle) {
    console.log('Directory Info', handle);
    const values = [];
    let items = 0;
    values.push({label: 'Kind', value: 'Folder'});
    const entries = await handle.getEntries();
    for await (const entry of entries) {
      items++;
    }
    values.push({label: 'Items', value: items});
    values.push({label: 'Where', value: this._path});
    this._showInfoDialog(values);
  }

  _showInfoDialog(values) {
    const container = document.createElement('div');
    values.forEach((item) => {
      const elem = document.createElement('div');
      const elemLabel = document.createElement('span');
      elemLabel.className = 'label';
      elemLabel.textContent = item.label + ':';
      const elemValue = document.createElement('span');
      elemValue.className = 'value';
      elemValue.textContent = item.value;
      elem.appendChild(elemLabel);
      elem.appendChild(elemValue);
      container.appendChild(elem);
    });
    this._infoContainer.replaceWith(container);
    this._infoContainer = container;
    this._showDialog('dialogInfo', true);
  }

  // **************************************************************
  // Preview a file
  // **************************************************************

  async _previewFile(handle) {
    const imgExtensions = ['jpg', 'png', 'gif', 'svg'];
    try {
      const file = await handle.getFile();
      console.log('h', handle);
      console.log('f', file);
      const filename = file.name;
      const extStart = filename.lastIndexOf('.');
      let extension = '';
      if (extStart > 0) {
        extension = filename.substr(extStart + 1);
      }
      let canPreview = false;
      if (extension === 'json' || extension === 'txt') {
        canPreview = await this._previewText(file);
      } else if (imgExtensions.includes(extension)) {
        canPreview = await this._previewImage(file);
      }
      if (canPreview) {
        this._previewTitle.textContent = handle.name;
        this._showDialog('dialogPreview', true);
      } else {
        // TODO
        window.alert(`No preview available for ${extension} files`);
      }
    } catch (ex) {
      console.error('err', ex);
    }
  }

  async _previewImage(file) {
    const bitmap = await createImageBitmap(file);
    const elem = document.createElement('canvas');
    const ctx = elem.getContext('bitmaprenderer');
    ctx.transferFromImageBitmap(bitmap);
    this._previewContainer.replaceWith(elem);
    this._previewContainer = elem;
    return true;
  }

  async _previewText(file) {
    const contents = await file.text();
    const elem = document.createElement('pre');
    elem.textContent = contents;
    this._previewContainer.replaceWith(elem);
    this._previewContainer = elem;
    return true;
  }

}
