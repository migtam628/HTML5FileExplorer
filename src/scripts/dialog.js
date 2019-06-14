'use strict';

/** Class to handle the dialog elements. */
class Dialog {
  /**
   * Create a Dialog element.
   * @param {string} divID - The ID of the div element for the dialog.
   */
  constructor(divID) {
    this._elem = document.getElementById(divID);
    this._container = document.getElementById('dialogContainer');
    this.show(false);
    const elems = this._elem.querySelectorAll('button.close');
    elems.forEach((elem) => {
      elem.addEventListener('click', () => {
        this.show(false);
      });
    });
  }
  /**
   * Shows or hides the dialog.
   * @param {boolean} [visible=false] - Show or hides the dialog.
   */
  show(visible) {
    this._container.classList.toggle('hidden', !visible);
    this._elem.classList.toggle('hidden', !visible);
  }
}
