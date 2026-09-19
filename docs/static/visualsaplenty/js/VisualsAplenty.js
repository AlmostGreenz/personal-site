"use strict";
(function(global, document) {

/**
 * Generate an array of length num of colour values 'rgb(r,g,b)' as strings.
 * For all colour values to be unique, num <= 768.
 * @param {number} num the integer number of colours to be returned
 * @return {array} colours array of length num of strings with colour values
 */
function generateColours(num) {
    const colours = [];
    const interval = 768 / (num);
    let rgb = [10, 125, 250];
    let toggler = false;

    for (let i = 768; i > 0; i -= interval) {
        let adjust = (i % 256 !== 0) ? i : 50;

        rgb[0] = Math.floor((rgb[0] + adjust) % 256);
        rgb[1] = ((rgb[1] + adjust * toggler) > 256) ? Math.floor(((rgb[1] + adjust * toggler) - 256) % 256) : rgb[1];
        rgb[2] = ((rgb[2] + adjust * !toggler) > 512) ? Math.floor(((rgb[2] + adjust * !toggler) - 512) % 256) : rgb[2];

        colours.push(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
        toggler = !toggler;
    }

    return colours;
}

class Legend {

    /**
     * Constructor function for Legend.
     * @param {HTMLElement} parentElement the parent element for this Legend
     */
    constructor(parentElement) {
        this.legendTable = document.createElement('table');
        this.legendTable.style.alignSelf = 'flex-end';
        this.legendTable.style.borderSpacing = '1px';
        this.legendTable.style.paddingLeft = '5%';
        this.legendTable.style.paddingRight = '2.5%';
        this.legendTable.style.transition = '0.3s';
        this.isVisible = true;
        parentElement.appendChild(this.legendTable);
    }

    /**
     * Delete the legend and redraw it based on the data provided.
     * @param {Object} data the data to be drawn, with elements that have property labelProperty
     * @param {string} labelProperty a property in all elements of data
     * @param {Array} colours an array of colour code strings
     * @param {number} height the pixel height of the parent element
     * @returns {Array} the array of colours for the new legend
     */
    updateLegend(data, labelProperty, colours, height) {
        if (this.legendTable.hasChildNodes()) {
            Array.from(this.legendTable.children).forEach((child) => {
                this.legendTable.removeChild(child);
            });
        }

        // generate bar colours
        if (colours.length !== data.length) {
            colours = generateColours(data.length);
        }

        this.legendTable.style.maxHeight = `${height}px`;

        // draw the legend to the browser
        for (let i = 0; i < data.length; i++) {
            let row = this.legendTable.insertRow();
            let colourSample = row.insertCell();
            colourSample.style.width = `7px`;
            colourSample.style.height = `${(Math.min(40, height / data.length))}px`;
            colourSample.style.backgroundColor = colours[i];
            let entry = row.insertCell();
            entry.innerText = data[i][labelProperty];
        }

        return colours;
    }

    /**
     * Change whether the legend should be visible.
     * @param {boolean} isVisible optional (otherwise, simply toggle setting) boolean indicating whether display or not
     * @return {boolean} whether the legend is now visible or not
     */
    setVisibility(isVisible = !this.isVisible) {
        this.isVisible = isVisible;

        this.legendTable.hidden = !this.isVisible;

        return this.isVisible;
    }
}

/**
 * Sort (decreasing) the data array in place by the values at data[keyToSortOn]
 * @param {array} data array of objects with key keyToSortOn
 * @param keyToSortOn key in the objects of array data
 * @return {boolean} whether the sorting has succeeded
 * @private
 */
function _SortData(data, keyToSortOn) {
    if (!data || (data.length > 0 && !data[0].hasOwnProperty(keyToSortOn))) {
        return false;
    }

    data.sort((element1, element2) => {
        if (element1[keyToSortOn] > element2[keyToSortOn]) {
            return 1;
        }

        if (element1[keyToSortOn] === element2[keyToSortOn]) {
            return 0;
        }

        return -1;
    });

    return true;
}

/**
 * Abstract class representing graphs with scales.
 */
class _ScaledGraph {

    /**
     * Constructor for the abstract _ScaledGraph class.
     * @param {string} title the title of the graph
     * @param {object} data array of objects containing the data to be displayed; data[vertAxis] and data[horAxis] must be numerical
     * @param {string} vertAxis string representing the attribute in all elements of data to be represented vertically
     * @param {string} horAxis string representing the attribute in all elements of data to be represented vertically
     * @param {HTMLElement} parentElement element that is to be the parent element of the graph
     */
    constructor(title, data, vertAxis, horAxis, parentElement) {
        this.outerDiv = document.createElement('div'); // the container for the _ScaledGraph element
        this.outerDiv.style.transition = '0.3s';
        parentElement.appendChild(this.outerDiv);

        this.tableHeight = 200;
        this.tableWidth = 300;

        // create title element
        this.title = document.createElement('h3');
        this.title.innerText = title;
        this.title.style.textAlign = 'center';
        this.title.style.transition = '0.3s';

        this.outerDiv.appendChild(this.title);

        this.data = data.slice(); // store data array, slice to allow us to re-arrange the elements (though objects are aliases still)
        this.dataAlias = data; // store alias of original data array (for reverting sort)

        // set up inner div
        this.innerDiv = document.createElement('div');
        this.innerDiv.style.display = 'flex';
        this.innerDiv.style.transition = '0.3s';
        this.outerDiv.appendChild(this.innerDiv);

        // set up vertical axis label
        this.vertAxisLabel = document.createElement('p');
        this.vertAxisLabel.innerText = vertAxis;
        this.vertAxisLabel.style.writingMode = 'vertical-rl';
        this.vertAxisLabel.style.alignSelf = 'flex-start';
        this.vertAxisLabel.style.marginTop = `${this.tableHeight / 2}px`;
        this.vertAxisLabel.style.transition = '0.3s';
        this.innerDiv.appendChild(this.vertAxisLabel);

        // set up scale
        this.vertScale = document.createElement('table');
        this.innerDiv.appendChild(this.vertScale);
        this.vertScale.style.alignSelf = 'flex-end';
        this.vertScale.style.borderSpacing = '0px';
        this.vertScale.style.marginBottom = '2px';
        this.vertScale.style.transition = '0.3s';

        this.vertSpaceAvailable = 0; // space in pixels per scale increment
        this.vertValuePerTick = 0;   // space in data value per scale increment

        this.legendKey = null;

        this.dataDisplayContainer = document.createElement('div');
        this.dataDisplayContainer.style.cssText = `border-bottom: 3px black solid; border-left: 3px black solid; width: ${this.tableWidth}px; height: ${this.tableHeight}px; align-self: flex-end; position: relative;`;
        this.dataDisplayContainer.style.transition = '0.3s';
        this.innerDiv.appendChild(this.dataDisplayContainer);

        // set up legend
        this.legend = new Legend(this.innerDiv);
        this.colours = [];
        this.customColour = false;
        this.highlightColor = 'rgb(252, 233, 122)';

        this._onHover = null
        this._afterHover = null
        this.imageKey = null;
        this.imageHoverKey = null;
    }

    /**
     * Update the vertical scale of the graph based on the dataset and tableHeight
     * @return maxValue maximum value of the data
     */
    updateScale() {
        if (this.vertScale.hasChildNodes()) {
            Array.from(this.vertScale.children).forEach((child) => {
                this.vertScale.removeChild(child);
            });
        }

        // get maximum value in dataset
        let maxValue = null;

        const valueAttribute = this.vertAxisLabel.innerText;

        this.data.forEach((cur) => {
            if (maxValue == null) {
                maxValue = cur[valueAttribute];
            } else if (maxValue < cur[valueAttribute]) {
                maxValue = cur[valueAttribute];
            }
        });

        // find scale label spacing and size based on maxValue and tableHeight
        this.vertScale.style.height = `${this.tableHeight}px`;
        this.vertScale.style.transform = 'scale(0.8)';

        if (maxValue > 0) {
            this.vertSpaceAvailable = this.tableHeight / 10;
            this.vertValuePerTick = maxValue / 10;
        } else {
            this.vertSpaceAvailable = this.tableHeight;
            this.vertValuePerTick = 0;
        }

        const cellStyle = {
            height: `${this.vertSpaceAvailable - 1}px`,
            fontSize: `${this.vertSpaceAvailable - (2 * this.tableHeight / 100)}px`,
            borderBottom: '1px black solid',
            padding: '0px',
            paddingRight: '2px',
            textAlign: 'right'
        }

        // draw scale labels to graph
        const isFloat = this.vertValuePerTick % 1 !== 0;

        for (let i = 0; i <= maxValue; i += this.vertValuePerTick) {
            let newRow = this.vertScale.insertRow(0);
            newRow.style.height = `${this.vertSpaceAvailable}px`;
            let newLabel = newRow.insertCell(); // add label to top of scale

            // if the scale increment is a float, adjust values for ergonomics
            if (isFloat) {
                newLabel.innerText = (i % 1 === 0) ? `${i}.0` : `${Math.round(10 * i) / 10}`;
            } else {
                newLabel.innerText = `${i}`;
            }

            Object.assign(newLabel.style, cellStyle); // assign the scale style
            newLabel.style.transform = 'scale(0.8)';
            setTimeout(() => {
                newLabel.style.transform = 'scale(1)';
            }, 50);
        }

        // in 50ms, make scale full-size (for animation when loading)
        setTimeout(() => {
            this.vertScale.style.transform = 'scale(1)';
        }, 50);

        return maxValue;
    }

    /**
     * Change the dimensions (in pixels) of the table.
     *
     * @param {number} width numerical pixel value > 0 or null if current width is to be maintained
     * @param {number} height numerical pixel value > 0 or null if current height is to be maintained
     * @returns {boolean} whether width and/or height were changed successfully
     */
    changeTableDimensions(width, height) {
        let success = false;

        if (((isNaN(width) || width <= 0) && width != null) || ((isNaN(height) || height <= 0) && height != null)) {
            return success;
        }

        if (width != null) {
            this.tableWidth = width;
            this.dataDisplayContainer.style.width = `${width}px`;
            success = true;
        }

        if (height != null) {
            this.tableHeight = height;
            this.dataDisplayContainer.style.height = `${height}px`;
            success = true;
        }

        return success;
    }

    /**
     * Update and draw the legend according to the dataset
     * Note: Colours on the graph are not updated (unless drawData has been called)
     */
    updateLegend() {
        if (this.legendKey !== null) {
            const colours = this.legend.updateLegend(this.data, this.legendKey, this.colours, this.tableHeight);

            if (!this.customColour) {
                this.colours = colours;
            }
        } else if (!this.customColour) {
            this.colours = generateColours(this.data.length);
        }
    }

    /**
     * Change whether the legend should be visible.
     * @param {boolean} isVisible optional (otherwise, simply toggle setting) boolean indicating whether display or not
     * @return {boolean} whether the legend is now visible or not
     */
    setLegendVisibility(isVisible = undefined) {
        return this.legend.setVisibility(isVisible);
    }

    /**
     * Set the colours of the data representation to values of the array of colour value strings.
     * @param colours array with length *this.data.length* containing colour value strings
     * @return {boolean} whether the colour change was successful
     */
    setColours(colours) {
        if (colours instanceof Array && colours.length === this.data.length) {
            this.colours = colours.slice();
            this.customColour = true;
            this.drawData();
            return true;
        }

        return false;
    }

    /**
     * Clear any custom colours for data representation that have been set and re-draw data representation if there have been colours set.
     */
    clearColours() {
        if (this.customColour) {
            this.customColour = false;
            this.drawData();
        }
    }

    /**
     * Set images (URL strings) to be displayed in the data representation and/or when hovered over by the key provided that corresponds to a image URL in the data array.
     * @param imageKey optional - key in data array that indicates images (by URL string) to be displayed in the data representation when no hovering is occurring
     * @param imageHoverKey optional - key in data array that indicates images (by URL string) to be displayed in the data representation when hovering is occurring
     */
    setImages(imageKey = null, imageHoverKey = null) {
        this.imageKey = imageKey;
        this.imageHoverKey = imageHoverKey;

        this.drawData();

        return true;
    }

    /**
     * Set onHover and afterHover functions for the data representation.
     * @param {function} onHover function to be called via EventListener when hovering occurs
     * @param {function} afterHover function to be called via EventListener when hovering ends
     */
    setOnHoverFunction(onHover, afterHover) {
        this._onHover = onHover;
        this._afterHover = afterHover;
        this.drawData();
    }

    /**
     * Clear any hover functions that have been set.
     */
    clearOnHoverFunctions() {
        if (this._onHover || this._afterHover) {
            this._onHover = null;
            this._afterHover = null;
            this.drawData();
        }
    }

    /**
     * Add data provided in dataToAdd to the graph.
     * NOTE: this data will be appended to the data array provided in the constructor.
     * @param {array} dataToAdd an array of objects with keys corresponding to horAxis and verAxis
     */
    addData(dataToAdd) {
        this.dataAlias.push(...dataToAdd);
        this.data = this.dataAlias.slice();
        this.customColour = false;

        this.drawData();
    }

    /**
     * Remove the data specified in dataToRemove from the graph.
     * NOTE: this data will be removed from the data array provided in the constructor.
     * @param {array} dataToRemove an array of objects with keys corresponding to horAxis and verAxis
     */
    removeData(dataToRemove) {
        dataToRemove.forEach((data) => {
            this.dataAlias.splice(this.dataAlias.indexOf(data), 1)
        });

        this.data = this.dataAlias.slice();
        this.customColour = false;

        this.drawData();
    }

    /**
     * Draw the data to the graph.
     */
    drawData() {
        throw new Error("_ScaledGraph is abstract and thus its data cannot be drawn.");
    }
}

class BarGraph extends _ScaledGraph {

    /**
     * Constructor for BarGraph
     * @param {string} title the title of the graph
     * @param {object} data array of objects containing the data to be displayed; data[vertAxis] and data[horAxis] must be numerical
     * @param {string} vertAxis string representing the attribute in all elements of data to be represented vertically
     * @param {string} horAxis string representing the attribute in all elements of data to be represented horizontally
     * @param {HTMLElement} parentElement element that is to be the parent element of the graph
     */
    constructor(title, data, vertAxis, horAxis, parentElement) {
        super(title, data, vertAxis, horAxis, parentElement);

        // set up bar display
        this.bars = []; // stores the bar elements
        this.effects = []; // stores effects (like the winning bar's crown)
        this.maxValueHonour = false;

        // set up horizontal axis label
        this.horAxisLabel = document.createElement('p');
        this.horAxisLabel.innerText = horAxis;
        this.horAxisLabel.style.textAlign = 'center';
        this.horAxisLabel.style.transition = '0.3s';
        this.outerDiv.appendChild(this.horAxisLabel);

        this.legendKey = horAxis;

        // set up sort selector
        _createSortSelect.call(this);

        this.drawData(); // draw the data bars (and scale)
    }

    /**
     * Update the scale of the graph based on the dataset and tableHeight
     * @return maxValue maximum value of the data
     */
    updateScale() {
        return super.updateScale();
    }

    /**
     * Add data provided in dataToAdd to the BarGraph.
     * NOTE: this data will be appended to the data array provided in the constructor.
     * @param {array} dataToAdd an array of objects with keys corresponding to horAxis and verAxis
     */
    addData(dataToAdd) {
        super.addData(dataToAdd);

        this.sortDropdown.value = '0';
    }

    /**
     * Remove the data specified in dataToRemove from the graph.
     * NOTE: this data will be removed from the data array provided in the constructor.
     * @param {array} dataToRemove an array of objects with keys corresponding to horAxis and verAxis
     */
    removeData(dataToRemove) {
        super.removeData(dataToRemove);

        this.sortDropdown.value = '0';
    }

    /**
     * Draw the bars of the graph based on the data in this.data
     */
    drawData() {
        if (this.bars.length !== 0) {
            this.bars.forEach((bar) => {
                this.dataDisplayContainer.removeChild(bar);
            });
        }

        if (this.effects.length !== 0) {
            this.effects.forEach((effect) => {
                this.dataDisplayContainer.removeChild(effect);
            });

            this.effects = [];
        }

        const maxValue = this.updateScale(); // update the scale to fit the new data
        this.updateLegend(); // update the legend

        const valueAttribute = this.vertAxisLabel.innerText;

        let count = 0;
        const width = this.tableWidth / this.data.length;

        // create bar elements and add them to dataDisplayContainer
        this.bars = this.data.map((entry) => {
            let newBar = document.createElement('div');
            newBar.style.width = '0px';
            newBar.style.backgroundColor = this.colours[count];
            newBar.style.backgroundImage = '';
            newBar.style.padding = '0px';
            newBar.style.height = '0px';
            newBar.style.backgroundSize = 'cover';
            newBar.style.backgroundPosition = 'center';
            newBar.style.position = 'absolute';
            newBar.style.bottom = '0px';
            newBar.style.left = `${width * count}px`;
            newBar.style.transition = '0.3s';

            // show image if setting is enabled
            if (this.imageKey && entry.hasOwnProperty(this.imageKey)) {
                newBar.style.backgroundImage = `url(${entry[this.imageKey]})`;
            }

            const hovertext = `${entry[this.legendKey]} - ${valueAttribute}: ${entry[valueAttribute]}`;
            newBar.title = hovertext;

            const addHighlight = () => {
                newBar.style.border = '1px solid black';
                newBar.style.zIndex = '1';

                newBar.style.color = newBar.style.backgroundColor;
                newBar.style.backgroundColor = this.highlightColor;

                newBar.style.backgroundImage = '';

                if (this.imageHoverKey && entry.hasOwnProperty(this.imageHoverKey)) {
                    newBar.style.backgroundImage = `url(${entry[this.imageHoverKey]})`;
                }
            };

            const removeHighlight = () => {
                newBar.style.border = 'none';
                newBar.style.zIndex = '';
                newBar.style.backgroundColor = newBar.style.color;

                newBar.style.backgroundImage = '';

                if (this.imageKey && entry.hasOwnProperty(this.imageKey)) {
                    newBar.style.backgroundImage = `url(${entry[this.imageKey]})`;
                }
            };

            // configuring hovering functionality
            newBar.addEventListener('mouseover', ((this._onHover === null) ? addHighlight : this._onHover));
            newBar.addEventListener('mouseleave', ((this._afterHover === null) ? removeHighlight : this._afterHover));

            // set up legend hovering functionality
            const legendEntry = this.legend.legendTable.querySelectorAll('tr')[count];
            legendEntry.title = hovertext;

            Array.from(legendEntry.children).forEach((entry) => {
                entry.addEventListener('mouseover', addHighlight);
                entry.addEventListener('mouseleave', removeHighlight);
            });

            const height = (entry[valueAttribute] / this.vertValuePerTick) * this.vertSpaceAvailable;

            // delay height and width for animation
            this.dataDisplayContainer.appendChild(newBar);
            setTimeout(() => {
                newBar.style.width = `${width}px`;
                newBar.style.height = `${height}px`;
            }, 20);


            // max value functionality
            if (this.maxValueHonour && entry[valueAttribute] === maxValue) {
                const celebrationText = document.createElement('p');
                celebrationText.innerHTML = '<i class="fas fa-crown"></i>'; // icon from FontAwesome
                celebrationText.style.color = 'gold';
                celebrationText.style.filter = 'drop-shadow(0px 0px 1px black)';
                celebrationText.style.fontSize = `${width * 0.5}px`;

                celebrationText.style.zIndex = '2';
                celebrationText.style.transition = '0.3s';
                celebrationText.style.position = 'absolute';
                celebrationText.style.marginBottom = `${height * 0.2}px`;

                celebrationText.style.left = `${(width * count) + (width * 0.2)}px`
                celebrationText.style.bottom = `${((entry[valueAttribute] / this.vertValuePerTick) * this.vertSpaceAvailable) - 20}px`;

                setTimeout(() => {
                    celebrationText.style.margin = '0px';
                }, 1);

                setInterval(() => {
                    if (celebrationText.style.transform === 'rotate(15deg)') {
                        celebrationText.style.transform = 'rotate(-12deg)'
                    } else {
                        celebrationText.style.transform = 'rotate(15deg)'
                    }
                }, 1000);

                this.dataDisplayContainer.appendChild(celebrationText);

                this.effects.push(celebrationText);
            }


            count++;
            return newBar;
        });
    }

    /**
     * Change the dimensions (in pixels) of the table.
     *
     * @param {number} width numerical pixel value > 0 or null if current width is to be maintained
     * @param {number} height numerical pixel value > 0 or null if current height is to be maintained
     * @returns {boolean} whether width and/or height were changed successfully
     */
    changeTableDimensions(width, height) {
        if (super.changeTableDimensions(width, height)) {
            this.drawData();
            return true;
        }

        return false;
    }

    /**
     * Change whether the bar(s) in the graph with the maximum value should have celebration effects and redraw in accordance.
     * @param {boolean} enable optional (otherwise, simply toggle setting) boolean indicating whether to honour maximum value bar or not
     * @return {boolean} whether the maximum value bar is to be honoured or not
     */
    setMaxValueHonour(enable = !this.maxValueHonour) {
        const oldVal = this.maxValueHonour;
        this.maxValueHonour = !!enable;

        if (oldVal !== this.maxValueHonour) {
            this.drawData();
        }

        return this.maxValueHonour;
    }

    /**
     * Sort the data displayed in the BarGraph and re-draw the bars.
     * @param {number} state 1 if to be sorted ascending, 0 if no sorting is to occur (or to revert sorting), -1 if to be sorted descending
     * @return {boolean} whether the operation was successful
     */
    sortData(state = 1) {
        if (state == 1 || state == -1) {
            if (!_SortData(this.data, this.vertAxisLabel.innerText)) {
                return false;
            }

            if (state != 1) {
                this.data.reverse(); // order the data ascending
            }
        } else if (state == 0) {
            this.data.length = 0; // clear the array
            this.data = this.dataAlias.slice(); // set the data to a clone of the original data
        } else {
            return false;
        }

        this.drawData(); // re-draw with the new data order
    }
}

class ScatterPlot extends _ScaledGraph {

    /**
     * Constructor for ScatterPlot
     * @param {string} title the title of the graph
     * @param {object} data array of objects containing the data to be displayed; data[vertAxis] and data[horAxis] must be numerical
     * @param {string} vertAxis string representing the attribute in all elements of data to be represented vertically
     * @param {string} horAxis string representing the attribute in all elements of data to be represented horizontally
     * @param {HTMLElement} parentElement element that is to be the parent element of the graph
     * @param {string} legendKey optional - string representing the attribute in all elements of data describing context
     */
    constructor(title, data, vertAxis, horAxis, parentElement, legendKey = undefined) {
        super(title, data, vertAxis, horAxis, parentElement);

        // set up scale
        this.horScale = document.createElement('table');
        this.horScale.style.transition = '0.3s';
        this.outerDiv.appendChild(this.horScale);

        this.horScale.insertRow();
        this.horAxisLabel = this.horScale.insertRow().insertCell();
        this.horAxisLabel.colSpan = 10;
        this.horAxisLabel.style.textAlign = 'center';
        this.horAxisLabel.innerText = horAxis;

        if (legendKey === null || legendKey === undefined) {
            this.legendKey = null;
        } else {
            this.legendKey = legendKey;
        }

        this.horScale.style.borderSpacing = '0px';
        this.horScale.style.marginBottom = '2px';

        this.horSpaceAvailable = 0;
        this.horValuePerTick = 0;

        // set up dot display
        this.dots = [] // dots array (for displaying data)

        this.dotSize = 20; // size in pixels (> 0) of the data-representing dots

        this.drawData();
    }

    /**
     * Re-process the scales and display the new version.
     */
    updateScale() {
        super.updateScale(); // update the vertical scale

        this.horScale.deleteRow(0);
        const scaleRow = this.horScale.insertRow(0);

        this.horScale.style.marginLeft = `${this.dataDisplayContainer.getBoundingClientRect().left - this.outerDiv.getBoundingClientRect().left + 1}px`

        // get maximum value in dataset
        let maxValue = null;
        let horLabel = this.horAxisLabel.innerText;

        this.data.forEach((cur) => {
            if (maxValue == null) {
                maxValue = cur[horLabel];
            } else if (maxValue < cur[horLabel]) {
                maxValue = cur[horLabel];
            }
        });

        // find scale label spacing and size based on maxValue and tableWidth

        if (maxValue > 0) {
            this.horSpaceAvailable = this.tableWidth / 10;
            this.horValuePerTick = maxValue / 10;
        } else {
            this.horSpaceAvailable = this.tableWidth;
            this.horValuePerTick = 0;
        }

        this.horScale.style.width = `${this.tableWidth + this.horSpaceAvailable}px`;

        const cellStyle = {
            width: `${this.horSpaceAvailable - 1}px`,
            fontSize: `${this.horSpaceAvailable - (2 * this.tableWidth / 100)}px`,
            borderLeft: '1px black solid',
            padding: '0px',
            paddingTop: '2px',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed'
        }

        const isFloat = this.horValuePerTick % 1 !== 0;

        // draw scale labels to graph
        for (let i = 0; i <= maxValue; i += this.horValuePerTick) {
            let newLabel = scaleRow.insertCell(); // add label to top of scale

            // if the scale increment is a float, adjust values for ergonomics
            if (isFloat) {
                newLabel.innerText = (i % 1 === 0) ? `${i}.0` : `${Math.round(10 * i) / 10}`;
            } else {
                newLabel.innerText = `${i}`;
            }

            Object.assign(newLabel.style, cellStyle); // assign the scale style
        }
    }

    /**
     * Draw the data (dots) to the graph and update scale.
     */
    drawData() {
        if (this.dots.length !== 0) {
            this.dots.forEach((dot) => {
                this.dataDisplayContainer.removeChild(dot);
            });
        }

        this.updateScale(); // update the scale to fit the new data
        this.updateLegend(); // update the legend

        const verAttribute = this.vertAxisLabel.innerText;
        const horAttribute = this.horAxisLabel.innerText;

        const verModifier = this.vertSpaceAvailable / this.vertValuePerTick;
        const horModifier = this.horSpaceAvailable / this.horValuePerTick;

        const halfDot = this.dotSize / 2;
        let count = 0;

        // create dot elements and add them to dataDisplayContainer
        this.dots = this.data.map((entry) => {
            let newDot = document.createElement('span');
            newDot.style.height = `${this.dotSize}px`;
            newDot.style.width = `${this.dotSize}px`;
            newDot.style.backgroundColor = this.colours[count];
            newDot.style.backgroundImage = '';
            newDot.style.borderRadius = '50%';
            newDot.style.padding = '0px';
            newDot.style.backgroundSize = 'cover';
            newDot.style.backgroundPosition = 'center';
            newDot.style.position = 'absolute';
            newDot.style.bottom = '0px';
            newDot.style.left = '0px';
            newDot.style.transition = '0.3s';

            // show image if setting is enabled
            if (this.imageKey && entry.hasOwnProperty(this.imageKey)) {
                newDot.style.backgroundImage = `url(${entry[this.imageKey]})`;
            }

            const hovertext = ((this.legendKey) ? `${entry[this.legendKey]} - ` : '') + `${horAttribute}: ${entry[horAttribute]}, ${verAttribute}: ${entry[verAttribute]}`;

            newDot.title = hovertext;

            const addHighlight = () => {
                newDot.style.border = '1px solid black';
                newDot.style.zIndex = '1';
                newDot.style.transform = 'scale(1.5)';

                newDot.style.color = newDot.style.backgroundColor;
                newDot.style.backgroundColor = this.highlightColor;
                newDot.style.backgroundImage = '';

                if (this.imageHoverKey && entry.hasOwnProperty(this.imageHoverKey)) {
                    newDot.style.backgroundImage = `url(${entry[this.imageHoverKey]})`;
                }
            };

            const removeHighlight = () => {
                newDot.style.border = 'none';
                newDot.style.zIndex = '';
                newDot.style.transform = 'scale(1.0)';

                newDot.style.backgroundColor = newDot.style.color;

                newDot.style.backgroundImage = '';

                if (this.imageKey && entry.hasOwnProperty(this.imageKey)) {
                    newDot.style.backgroundImage = `url(${entry[this.imageKey]})`;
                }
            };

            // configuring hovering functionality
            // configuring hovering functionality
            newDot.addEventListener('mouseover', ((this._onHover === null) ? addHighlight : this._onHover));
            newDot.addEventListener('mouseleave', ((this._afterHover === null) ? removeHighlight : this._afterHover));

            if(this.legendKey) {
                const legendEntry = this.legend.legendTable.querySelectorAll('tr')[count];
                legendEntry.title = hovertext;

                Array.from(legendEntry.children).forEach((entry) => {
                    entry.addEventListener('mouseover', addHighlight);
                    entry.addEventListener('mouseleave', removeHighlight);
                });
            }

            this.dataDisplayContainer.appendChild(newDot);
            count++;

            setTimeout(() => {
                newDot.style.bottom = `${(entry[verAttribute] * verModifier) - halfDot}px`;
                newDot.style.left = `${(entry[horAttribute] * horModifier) - halfDot}px`;
            }, 20);

            return newDot;
        })
    }

    /**
     * Change the size of the data dots in the ScatterPlot.
     * @param {number} newSize the size (> 0) in pixels to change the dot size to
     * @return {boolean} whether the input was valid and change was successful
     */
    updateDotSize(newSize) {
        if (!isNaN(newSize) && newSize > 0) {

            const oldSize = this.dotSize;

            this.dotSize = newSize;

            const adjustment = (oldSize - newSize) / 2;

            this.dots.forEach((dot) => {
                dot.style.height = `${this.dotSize}px`;
                dot.style.width = `${this.dotSize}px`;

                dot.style.bottom = `${parseInt(dot.style.bottom) + adjustment}px`;
                dot.style.left = `${parseInt(dot.style.left) + adjustment}px`;
            });

            return true;
        }

        return false;
    }

    /**
     * Change the dimensions (in pixels) of the table.
     *
     * @param {number} width numerical pixel value > 0 or null if current width is to be maintained
     * @param {number} height numerical pixel value > 0 or null if current height is to be maintained
     * @returns {boolean} whether width and/or height were changed successfully
     */
    changeTableDimensions(width, height) {
        if (super.changeTableDimensions(width, height)) {
            this.drawData();
            return true;
        }

        return false;
    }

}

class PieChart {

    /**
     * Constructor for PieChart.
     * @param {string} title the title of the pie chart
     * @param {object} data array of objects containing the data to be displayed; data[valueKey] must contain the numerical data and data[labelKey] a corresponding string
     * @param {string} valueKey string representing the attribute in all elements of data
     * @param {string} labelKey string representing the attribute in all elements of data
     * @param {HTMLElement} parentElement element that is to be the parent element of the graph
     */
    constructor(title, data, valueKey, labelKey, parentElement) {
        if (!data || data.length > 0 && (!data[0].hasOwnProperty(valueKey) || !data[0].hasOwnProperty(labelKey))) {
            throw new Error(`PieChart data not provided or does not contain property '${valueKey}'`);
        }

        this.valueKey = valueKey;
        this.labelKey = labelKey;

        this.outerDiv = document.createElement('div'); // the container for the _ScaledGraph element
        this.outerDiv.style.transition = '0.3s';
        parentElement.appendChild(this.outerDiv);

        // set default dimensions
        this.pieDiameter = 300;

        // create title element
        this.title = document.createElement('h3');
        this.title.innerText = title;
        this.title.style.textAlign = 'center';
        this.title.style.transition = '0.3s';

        this.outerDiv.appendChild(this.title);

        this.data = data.slice(); // store data array, slice to allow us to re-arrange the elements (though objects are aliases still)
        this.dataAlias = data; // store alias of original data array (for reverting sort)

        // set up inner div
        this.innerDiv = document.createElement('div');
        this.innerDiv.style.display = 'flex';
        this.innerDiv.style.transition = '0.3s';
        this.outerDiv.appendChild(this.innerDiv);

        // set up data display div (where the chart will be displayed)
        this.dataDisplay = document.createElement('div');
        this.dataDisplay.style.borderRadius = '50%';
        this.dataDisplay.style.width = `${this.pieDiameter}px`;
        this.dataDisplay.style.height = `${this.pieDiameter}px`;
        this.dataDisplay.style.margin = '10px 10px 10px 30px';
        this.dataDisplay.style.transition = '0.3s';
        this.innerDiv.appendChild(this.dataDisplay);

        // set up legend
        this.legend = new Legend(this.innerDiv);
        this.colours = [];
        this.customColour = false;

        // set up sort selector
        _createSortSelect.call(this);

        this.sliceEntries = [];
        this.drawData();
    }

    /**
     * Set the colours of the pie slices to values of the array of colour value strings.
     * @param colours array with length *this.data.length* containing colour value strings
     * @return {boolean} whether the colour change was successful
     */
    setColours(colours) {
        if (colours instanceof Array && colours.length === this.data.length) {
            this.colours = colours.slice();
            this.customColour = true;
            this.drawData();
            return true;
        }

        return false;
    }

    /**
     * Clear any custom colours for PieChart that have been set and re-draw pie slices if there have been colours set.
     */
    clearColours() {
        if (this.customColour) {
            this.customColour = false;
            this.drawData();
        }
    }

    /**
     * Add data provided in dataToAdd to the graph.
     * NOTE: this data will be appended to the data array provided in the constructor.
     * @param {array} dataToAdd an array of objects with keys corresponding to horAxis and verAxis
     */
    addData(dataToAdd) {
        this.dataAlias.push(...dataToAdd);
        this.data = this.dataAlias.slice();
        this.customColour = false;

        this.drawData();
        this.sortDropdown.value = '0';
    }

    /**
     * Remove the data specified in dataToRemove from the PieChart.
     * NOTE: this data will be removed from the data array provided in the constructor.
     * @param {array} dataToRemove an array of objects with keys corresponding to horAxis and verAxis
     */
    removeData(dataToRemove) {
        dataToRemove.forEach((data) => {
            this.dataAlias.splice(this.dataAlias.indexOf(data), 1)
        });

        this.data = this.dataAlias.slice();
        this.customColour = false;

        this.drawData();

        this.sortDropdown.value = '0';
    }

    /**
     * Draw the data (a.k.a. pie slices) to the graph alongside (if enabled) an updated legend.
     */
    drawData() {
        this.updateLegend();

        this.sliceEntries.length = 0; // clear the slice entries
        this.dataDisplay.style.transform = 'rotate(-15deg)';

        // set up the styling
        let styleTemplate = "conic-gradient(";

        // find the total of all the data
        let dataSum = 0;
        this.data.forEach(entry => {
            dataSum += entry[this.valueKey];
        });

        // find the degree per one point of data (to properly allocate the slices)
        let degreePerData = 360.0 / dataSum;

        let lastDegree = null;
        let colourIdx = 0;

        // set up each slice as its proper degree size and colour
        this.data.forEach(entry => {
            let curDegree = (entry[this.valueKey] * degreePerData) + ((lastDegree !== null) ? lastDegree : 0);

            if (lastDegree !== null) {
                styleTemplate += `, ${this.colours[colourIdx]} ${lastDegree}deg`;
            } else {
                styleTemplate += this.colours[colourIdx];
            }

            lastDegree = curDegree;

            let newEntry = ` ${curDegree}deg`;

            styleTemplate += newEntry;

            this.sliceEntries.push(newEntry);

            // hovertext functionality
            const legendEntry = this.legend.legendTable.querySelectorAll('tr')[colourIdx];

            legendEntry.title = `${entry[this.labelKey]} - ${this.valueKey}: ${entry[this.valueKey]}`;

            colourIdx++;
        });

        this.dataDisplay.style.background = styleTemplate + ")";

        setTimeout(() => {
            this.dataDisplay.style.transform = 'rotate(0deg)';
        }, 100);
    }

    /**
     * Update and draw the legend according to the dataset
     * Note: Pie Slice colours are not updated (unless drawData has been called)
     */
    updateLegend() {
        this.colours = this.legend.updateLegend(this.data, this.labelKey, this.colours, this.pieDiameter);
    }

    /**
     * Change whether the legend should be visible.
     * @param {boolean} isVisible optional (otherwise, simply toggle setting) boolean indicating whether display or not
     * @return {boolean} whether the legend is now visible or not
     */
    setLegendVisibility(isVisible = undefined) {
        return this.legend.setVisibility(isVisible);
    }

    /**
     * Change the dimensions (in pixels) of the PieChart.
     *
     * @param {number} diameter numerical pixel value > 0
     * @returns {boolean} whether diameter was changed successfully and PieChart re-drawn
     */
    changeTableDimensions(diameter) {
        // check if diameter is valid and perform changes if so
        if (diameter > 0) {
            this.pieDiameter = diameter;
            this.dataDisplay.style.width = `${this.pieDiameter}px`;
            this.dataDisplay.style.height = `${this.pieDiameter}px`;
            this.drawData();
            return true;
        }

        return false;
    }

    /**
     * Sort the data displayed in the PieChart and re-draw the pie slices.
     * @param {number} state 1 if to be sorted ascending clockwise, 0 if no sorting is to occur (or to revert sorting), -1 if to be sorted descending clockwise
     * @return {boolean} whether the operation was successful
     */
    sortData(state = 1) {
        if (state == 1 || state == -1) {
            if (!_SortData(this.data, this.valueKey)) {
                return false;
            }

            if (state != 1) {
                this.data.reverse(); // order the data ascending
            }
        } else if (state == 0) {
            this.data.length = 0; // clear the array
            this.data = this.dataAlias.slice(); // set the data to a clone of the original data
        } else {
            return false;
        }

        this.drawData(); // re-draw with the new data order
    }
}

/**
 * Private function to be called in a graph class that will create a select input for use in sorting and append it to this.outerDiv.
 * Precondition: the class *this* has function *sortData* implemented.
 * @private
 */
function _createSortSelect() {
    const sortDropdown = document.createElement('select');
    sortDropdown.onchange = (e) => {
        this.sortData(e.target.value);
    }; // function to sort data when different option selected
    sortDropdown.style.textAlign = 'center';
    sortDropdown.style.outline = 'none';
    sortDropdown.style.border = 'none';

    // set up the options for sorting
    let option = document.createElement('option');
    option.innerText = 'Unsorted';
    option.value = '0';
    option.defaultSelected = true;
    sortDropdown.appendChild(option);

    option = document.createElement('option');
    option.innerText = 'Ascending';
    option.value = '1';
    sortDropdown.appendChild(option);

    option = document.createElement('option');
    option.innerText = 'Descending';
    option.value = '-1';
    sortDropdown.appendChild(option);

    // set up div containing the sort input
    const sortDiv = document.createElement('div');
    sortDiv.style.borderRadius = '36px'
    sortDiv.style.overflow = 'hidden';
    sortDiv.style.border = '1px solid black';
    sortDiv.style.display = 'inline-block';
    sortDiv.style.marginLeft = '1.5%';
    sortDiv.appendChild(sortDropdown);
    this.outerDiv.appendChild(sortDiv);

    this.sortDropdown = sortDropdown;
}

    // Add the API to the window object if it does not already exist
    global.BarGraph = global.BarGraph || BarGraph;
    global.Legend = global.Legend || Legend;
    global.PieChart = global.PieChart || PieChart;
    global.ScatterPlot = global.ScatterPlot || ScatterPlot;
    global.generateColours = global.generateColours || generateColours;


})(window, window.document); // pass the global window object and jquery to the anonymous function. They will now be locally scoped inside of the function.
