const canvas = document.getElementById('spreadsheet');
const ctx = canvas.getContext('2d');

const cellHeight = 25;
const headerHeight = 25;
const headerWidth = 50;

let scrollX = 0;
let scrollY = 0;
let cellData = {};
let editingCell = null;
let selectedCell = null;
let selectedRange = null;
let isDragging = false;
let isResizing = false;
let resizingColumn = null;
let isResizingSelection = false;
let cellWidths = {};
const defaultCellWidth = 100;
let pageNo = 1;
let row = []

async function initializeCellData(pgno) {
    await getData(pgno);
    //console.log(row)
    let maxColumns = 0;

    for (let i = 0; i < row.length; i++) {
        cellData[i] = [];
        for (let j = 0; j < row[i].length + 50; j++) {
            if (j < row[i].length) {
                cellData[i][j] = row[i][j].split(": ")[1];
            } else {
                cellData[i][j] = '';  // Empty cell for columns beyond the data
            }
            if (!cellWidths[j]) {
                cellWidths[j] = defaultCellWidth;
            }
        }
    }

    // console.log(maxColumns);
}

function resizeCanvas() {
    canvas.width = window.innerWidth +1000;
    canvas.height = window.innerHeight - document.getElementById('stats').offsetHeight -100;
    drawSpreadsheet();
}

function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;

    let currentX = headerWidth - scrollX;
    const endCol = getVisibleColumnRange().end;
    const startRow = Math.floor(scrollY / cellHeight);
    const endRow = startRow + Math.ceil(canvas.height / cellHeight);

    for (let col = 0; col <= endCol; col++) {
        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, canvas.height);
        ctx.stroke();
        currentX += cellWidths[col];
    }

    for (let row = startRow; row <= endRow; row++) {
        const y = headerHeight + row * cellHeight - scrollY;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headerWidth, 0);
    ctx.lineTo(headerWidth, canvas.height);
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(canvas.width, headerHeight);
    ctx.stroke();
}

function drawHeaders() {
    ctx.font = '12px Arial';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const { start: startCol, end: endCol } = getVisibleColumnRange();
    const startRow = Math.floor(scrollY / cellHeight);
    const endRow = startRow + Math.ceil(canvas.height / cellHeight);

    let currentX = headerWidth - scrollX;
    for (let col = startCol; col <= endCol; col++) {
        const letter = getColumnLabel(col);
        ctx.fillText(letter, currentX + cellWidths[col] / 2, headerHeight / 2);
        currentX += cellWidths[col];
    }

    for (let row = startRow; row <= endRow; row++) {
        const y = headerHeight + row * cellHeight - scrollY + cellHeight / 2;
        ctx.fillText(row + 1, headerWidth / 2, y);
    }
}

function getColumnLabel(column) {
    let label = '';
    while (column >= 0) {
        label = String.fromCharCode(65 + (column % 26)) + label;
        column = Math.floor(column / 26) - 1;
    }
    return label;
}

function drawSelectionHandle(x, y) {
    const size = 7;
    const halfSize = size / 2;
    ctx.fillStyle = '#1a73e8';

    // Draw a square handle centered at (x, y)
    ctx.fillRect(x - halfSize, y - halfSize, size, size);
}

function heighlightCells() {
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const { start: startCol, end: endCol } = getVisibleColumnRange();
    const startRow = Math.floor(scrollY / cellHeight);
    const endRow = startRow + Math.ceil(canvas.height / cellHeight);

    let currentX = headerWidth - scrollX;
    for (let col = startCol; col <= endCol; col++) {
        const x = currentX;
        for (let row = startRow; row <= endRow; row++) {
            const y = headerHeight + row * cellHeight - scrollY;
            const value = cellData[row] && cellData[row][col] ? cellData[row][col] : '';

            ctx.save();
            ctx.beginPath();
            ctx.rect(x, y, cellWidths[col], cellHeight);
            ctx.clip();

            if (selectedRange &&
                row >= Math.min(selectedRange.startRow, selectedRange.endRow) &&
                row <= Math.max(selectedRange.startRow, selectedRange.endRow) &&
                col >= Math.min(selectedRange.startCol, selectedRange.endCol) &&
                col <= Math.max(selectedRange.startCol, selectedRange.endCol)) {

                ctx.fillStyle = '#CCD5E3';
                ctx.fillRect(x, y, cellWidths[col], cellHeight);

                ctx.fillStyle = 'black';
            } else {
                ctx.fillStyle = '#000';
            }

            ctx.fillText(value, x + 5, y + cellHeight / 2);

            ctx.restore();

            if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
                ctx.strokeStyle = '#1a73e8';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, cellWidths[col], cellHeight);
            }
        }
        currentX += cellWidths[col];
    }

    // Draw border around selected range
    if (selectedRange) {
        const minRow = Math.min(selectedRange.startRow, selectedRange.endRow);
        const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow);
        const minCol = Math.min(selectedRange.startCol, selectedRange.endCol);
        const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol);

        const startX = getColumnLeftEdge(minCol);
        const startY = headerHeight + minRow * cellHeight - scrollY;
        const width = getColumnRightEdge(maxCol) - startX;
        const height = (maxRow - minRow + 1) * cellHeight;

        ctx.strokeStyle = '#1a73e8';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, width, height);

        // Draw selection handle
        const handleX = startX + width;
        const handleY = startY + height;
        drawSelectionHandle(handleX, handleY);
    }
}

function calculateStats() {
    if (!selectedRange) return;

    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow);
    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow);
    const minCol = Math.min(selectedRange.startCol, selectedRange.endCol);
    const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol);

    let sum = 0;
    let count = 0;
    let min = Infinity;
    let max = -Infinity;

    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            const value = parseFloat(cellData[row] && cellData[row][col] ? cellData[row][col] : 0);
            if (!isNaN(value)) {
                sum += value;
                count++;
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        }
    }

    const average = count > 0 ? sum / count : 0;

    const statsDiv = document.getElementById('stats');
    statsDiv.innerHTML = `
        Sum: ${sum.toFixed(2)}<br>
        Average: ${average.toFixed(2)}<br>
        Smallest: ${min === Infinity ? 'N/A' : min.toFixed(2)}<br>
        Greatest: ${max === -Infinity ? 'N/A' : max.toFixed(2)}
    `;
}

function handleScroll(event) {
    event.preventDefault();
    scrollX += event.deltaX;
    scrollY += event.deltaY;
    scrollX = Math.max(0, scrollX);
    scrollY = Math.max(0, scrollY);
    drawSpreadsheet();
    pageNo += 1
    initializeCellData(pageNo);
}

function handleClick(event) {
 
    const mouseX = event.clientX - canvas.offsetLeft;
    const mouseY = event.clientY - canvas.offsetTop;
   
    const clickedCol = getColumnFromX(mouseX);
    const clickedRow = Math.floor((mouseY - headerHeight + scrollY) / cellHeight);

    selectedCell = { row: clickedRow, col: clickedCol };
    selectedRange = null;
    editingCell = selectedCell;

    drawSpreadsheet();
}

function handleMouseDown(event) {
    const mouseX = event.clientX - canvas.offsetLeft;
    const mouseY = event.clientY - canvas.offsetTop;

    if (selectedRange) {
        const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow);
        const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol);
        const handleX = getColumnRightEdge(maxCol) - scrollX;
        const handleY = headerHeight + (maxRow + 1) * cellHeight - scrollY;

        if (Math.abs(mouseX - handleX) <= 5 && Math.abs(mouseY - handleY) <= 5) {
            isResizingSelection = true;
            return;
        }
    }

    if (mouseY <= headerHeight) {
        const col = getColumnFromX(mouseX);
        const colRightEdge = getColumnRightEdge(col);
        if (Math.abs(mouseX - colRightEdge) <= 5) {
            isResizing = true;
            resizingColumn = col;
        } else {
            isDragging = true;
            handleClick(event);
        }
    } else {
        isDragging = true;
        handleClick(event);
    }
}

function handleMouseUp() {
    isDragging = false;
    isResizing = false;
    isResizingSelection = false;
    resizingColumn = null;
    calculateStats();
}

function handleMouseMove(event) {
    const mouseX = event.clientX - canvas.offsetLeft;
    const mouseY = event.clientY - canvas.offsetTop;

    if (isResizingSelection && selectedRange) {
        const currentCol = getColumnFromX(mouseX);
        const currentRow = Math.floor((mouseY - headerHeight + scrollY) / cellHeight);

        selectedRange.endRow = currentRow;
        selectedRange.endCol = currentCol;

        drawSpreadsheet();
        return;
    }

    if (isResizing) {
        const minWidth = 50;  // Minimum column width
        const newWidth = Math.max(minWidth, mouseX - getColumnLeftEdge(resizingColumn));
        cellWidths[resizingColumn] = newWidth;
        drawSpreadsheet();
    } else if (isDragging) {
        const currentCol = getColumnFromX(mouseX);
        const currentRow = Math.floor((mouseY - headerHeight + scrollY) / cellHeight);

        selectedRange = {
            startRow: selectedCell.row,
            startCol: selectedCell.col,
            endRow: currentRow,
            endCol: currentCol
        };

        drawSpreadsheet();
    } else if (mouseY <= headerHeight) {
        const col = getColumnFromX(mouseX);
        const colRightEdge = getColumnRightEdge(col);
        if (Math.abs(mouseX - colRightEdge) <= 5) {
            canvas.style.cursor = 'col-resize';
        } else {
            canvas.style.cursor = 'default';
        }
    } else {
        canvas.style.cursor = 'default';
    }
}
//return the column number
function getColumnFromX(x) {
    let currentX = headerWidth - scrollX;
    for (let col = 0; col < Object.keys(cellWidths).length; col++) {
        if (x >= currentX && x < currentX + cellWidths[col]) {
            return col;
        }
        currentX += cellWidths[col];
    }
    return -1;
}

//left side of actual clicked  cell position in px
function getColumnLeftEdge(col) {
    
    let x = headerWidth - scrollX;
    for (let i = 0; i < col; i++) {
        x += cellWidths[i];
    }
   
    return x;
}
//right of actual clicked cell position in px
function getColumnRightEdge(col) {
    return getColumnLeftEdge(col) + cellWidths[col];
}

//give the start of column and end column in your window screen
function getVisibleColumnRange() {
    let start = 0;
    let end = 0;
    let currentX = headerWidth - scrollX;


    while (currentX < 0 && start < Object.keys(cellWidths).length) {
        currentX += cellWidths[start];
        start++;
    }

    while (currentX < canvas.width && end < Object.keys(cellWidths).length) {
        currentX += cellWidths[end];
        end++;
    }

    return { start: Math.max(0, start - 1), end: end };
}
//backspce functionality & arrow 
function handleArrowKey(event) {
    if (!selectedCell) return;

    switch (event.key) {
        case 'ArrowUp':
break;

        case 'Arrowdown':
            break;

        case 'ArrowLeft':
            break;

        case 'ArrowRight':
            break;
        default:
            if (editingCell && /^[a-zA-Z0-9!@#$%^&*(),.?":{}|<> ]$/.test(event.key)) {
                if (!cellData[editingCell.row]) {
                    cellData[editingCell.row] = [];
                }

                if (!cellData[editingCell.row][editingCell.col]) {
                    cellData[editingCell.row][editingCell.col] = '';
                }
                cellData[editingCell.row][editingCell.col] += event.key;
            } else if (event.key === 'Backspace' && editingCell) {
                if (cellData[editingCell.row] && cellData[editingCell.row][editingCell.col]) {
                    cellData[editingCell.row][editingCell.col] = cellData[editingCell.row][editingCell.col].slice(0, -1);
                }
            } else {
                return;
            }
    }

    selectedRange = null;
    editingCell = selectedCell;
   // event.preventDefault();
    drawSpreadsheet();
    calculateStats();
}

function drawSpreadsheet() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawHeaders();
    heighlightCells();
    calculateStats();
}
const getData = async (pageno) => {
    let response = await fetch(`http://localhost:5006/api/Crud/100/${pageno}`);
    let data = await response.json();
    for (let i = 0; i < data.length; i++) {
        let res = data[i];
        row.push(res.split(","));
    }
    return row;
}

window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('wheel', handleScroll, { passive: false });
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
document.addEventListener('keydown', handleArrowKey);

initializeCellData(pageNo);
resizeCanvas();