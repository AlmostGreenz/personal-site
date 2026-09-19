"use strict";

// Favourite TV Show BarGraph Example:
const tvData = [
    {
        Show: "LOST",
        Count: 140
    },
    {
        Show: "Sherlock",
        Count: 99
    },
    {
        Show: "Smallville",
        Count: 88
    },
    {
        Show: "Hawkeye",
        Count: 76
    }
]

const tvTableDiv = document.querySelector('#backgroundGraph');

const favTVShow = new BarGraph("Favourite TV Show", tvData, "Count", "Show", tvTableDiv);
favTVShow.setLegendVisibility(false);
favTVShow.changeTableDimensions(1625, 725);
favTVShow.horAxisLabel.hidden = true;
favTVShow.vertAxisLabel.hidden = true;
favTVShow.title.hidden = true;
// hide the sorting select input
const sortSelect = favTVShow.outerDiv.querySelector('select');
sortSelect.hidden = true;
sortSelect.parentElement.style.border = 'none';

// disable tooltip
favTVShow.bars.forEach((bar) => {
    bar.title = '';
});

// timed, recursive calls to facilitate the animation
const dataChange = () => {
    let valueChoices = [140, 99, 80, 66];

    favTVShow.bars.forEach((bar) => {
        bar.style.height = `${((valueChoices.splice(Math.floor(valueChoices.length * Math.random()), 1)[0]) / favTVShow.vertValuePerTick) * favTVShow.vertSpaceAvailable}px`;
    });

    setTimeout(dataChange, 1500);
}

setTimeout(dataChange, 1500);
