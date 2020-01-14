/*
 * Scarlatti Notation
 * Copyright Hallgrim Bratberg 2020
 * */

// Set TAB = 4 spaces for comment alignment

var canvas;
var context;
var width;
var height;
var Q_NOTE = 30240; // No of ticks in a quarter note
var spacingPx =10; // The main zoom level: Spacing between lines in a staff
var systemSpacing = 20;
var drawScale = 1; // The canvas scaling factor
var padding = 0.3; // The minimum padding between items, times  spacingPx.
var emptyBarMinSpace = 32; // Releated to spacing
var restsMaxNrDots = 2; // The maximum nr of dots on a rest.
var stemW = spacingPx/30;
var HIGHEST_UPSTEM_YPOS = 2.0;
var BEAM_THICKNESS = 2/5;
var wantedMeasPrSystem = 2;

var MAX_DOTS = 1;

var staffs = [];
var musicSystem; // The main score, all staffs combined
var imagesCount = 100; // The number of images
var itemImages = [imagesCount]; // All images of the notation items.
var itemImagesInfo = [imagesCount]; // Scaling data etc.
var systemMeasures = []; // All system measures
var score; // The current active score

//INPUT VARIABLES:
var inputNoteValue = 6;
var inputCurrentTicksPos = 0;
var inputCurrentMeasNr = 0;
var inputNoteNr;
var inputOctaveOffset = 60;

//UNDO:
//historyStack stores every action
var historyStack = []

// Dictionary for note input via keyboard: keys = notename letters, value = noteNr in scale.
var noteNamesToNr = { "c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11};

// Table setting the Y axis offsets of the noteNr´s in a GClef.(noteRest.topY against top line in staff)
//                      C   C#    D    Eb   E    F     F#    G   G#     A     Bb     B
var NOTENR_Y_OFFSET = [ 1, 0.75, 0.5, 0.25, 0, -0.5, -0.75, -1, -1.25, -1.5, -1.75, -2];

//                        Cb                Gb,                  Db                 Ab
var KEYS_Y_OFFSET = [[4, -0.5, 5, -0.75], [11, -2.5, 0, 0.75 ],[6, -1, 7, -1.25],[1, 0.5, 2, 0.25],
//                        Eb                Bb                 F                 C
					 [8, -1.5, 9, -1.75],[3, 0, 4, -0.25],[10, -2, 11, -2.25],[-1, 0, -1, 0  ],
//						  G					D				A 					E
					  [5, -0.25, 6, -0.5],[0, 1.25, 1, 1],[7, -0.75, 8, -1],[2, 0.75, 3, 0.5 ],
//						  B					F#				 C#
					  [9, -1.25, 10, -1.5],[4, 0.25, 5, 0],[11, -1.75, 0, 1.5]];

var C_SCALE_FROM_CHROM = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6];



window.onload = function(){
	canvas = document.createElement( 'canvas' );
	context = canvas.getContext('2d');
	document.body.appendChild(canvas);

	loadImgs();

	score = new Score();
	score.masterStaff = new MasterStaff();

	score.masterStaff.insertKey(new Key(0, 0, 0)); // Key, QnotePos, ticksPos
	score.masterStaff.insertTimeSignature(new TimeSignature(4,4, 0, 0)); // topNr, botNr, qNotePos, ticksPos
	score.masterStaff.timeSigs[0].beamGroups = [Q_NOTE, Q_NOTE, Q_NOTE, Q_NOTE];

	score.staffs[0] = new Staff(this.masterStaff);
	score.staffs[0].insertClef(new Clef(50, 0, 0)); // clefNr, qNotePos, ticksPos

	score.appendMeasures(33);


	//NoteRest(isNote, noteNr)
	//noteR, noteValue, dots, ticksPos, measureNr, staffNr, VoiceNr
	//score.addNoteRest(new NoteRest(true, 60), 6, 0, Q_NOTE * 0,  0, 0, 0);

	score.addPart();
	score.parts[0].addPage();
	for(var i = 0; i < score.systemMeasures.length; i++){
		score.sendSysMeasureToParts(score.systemMeasures[i], 0);
	}
	score.updateMeasures(0, Q_NOTE * 100);
	score.buildGraphic();

	window.addEventListener("keydown", function(event){
		handleKeyPressed(event);
	});

};



var handleKeyPressed = function(event){
	var validEntry = false;
	var keyNr = event.key.charCodeAt(0);
	console.log("Code: " + event.code + "  key: " + keyNr);
	if(keyNr > 48 && keyNr < 58){
		// Setting input noteLength:
		inputNoteValue = keyNr - 48;
		validEntry = true;
	}
	else if(event.key in noteNamesToNr){
		handleInLineMusicInput(event);
		validEntry = true;
	}
	else if(keyNr == 65){
		console.log("Piltast!");
	}
	else if(keyNr == 122){
		undo();
	}
};

var handleInLineMusicInput = function(){
	var prevInputNoteNr = inputNoteNr;
	inputNoteNr = inputOctaveOffset + noteNamesToNr[event.key];
	if(inputNoteNr - prevInputNoteNr < -6){
		inputNoteNr += 12;
		inputOctaveOffset += 12;
	}
	else if(inputNoteNr - prevInputNoteNr > 6){
		inputNoteNr -= 12;
		inputOctaveOffset -= 12;
	}
	nr = new NoteRest(true, inputNoteNr);
	score.addNoteRest(nr, inputNoteValue, 0, inputCurrentTicksPos,  inputCurrentMeasNr, 0, 0);
	historyStack.push({"subject": score, "action": "addNoteRest", "object": nr,
										 "noteValue": inputNoteValue, "ticksPos": inputCurrentTicksPos,
									 	 "measNr": inputCurrentMeasNr});
	score.updateMeasures(0, Q_NOTE * 100);
	score.buildGraphic();
	inputCurrentTicksPos += Q_NOTE / Math.pow(2, 6 - inputNoteValue);
	if(inputCurrentTicksPos >= Q_NOTE * 4){
		inputCurrentTicksPos = 0;
		inputCurrentMeasNr += 1;
	}
	render(true);
};

var loadImgs = function(){
	var i;
	for(i = 0; i < imagesCount; i++){
		itemImages[i] = new Image();
		itemImagesInfo[i] = new ItemImgInfo(0, 0, 0, 0);
		itemImagesInfo[i].isLoaded = true;
	}
	// Loading the images:
	setImage(0, "images/BlackNotehead.svg", new ItemImgInfo(1, 1.15, 0, 0));
	itemImagesInfo[0].param1 = 0.026; // stemX left offset from note leftX: times spacingPx
	itemImagesInfo[0].param2 = 1.11; // stemX right offset from note leftX
	itemImagesInfo[0].param3 = 0.6; // stemY left offset from note upperY
	itemImagesInfo[0].param4 = 0.4; // stemY right offset from note upperY
	setImage(1, "images/WhiteNotehead.svg", new ItemImgInfo(1, 1.15, 0, 0));
	itemImagesInfo[1].param1 = 0.025; // stemX left offset from note leftX
	itemImagesInfo[1].param2 = 1.13; // stemX right offset from note leftX
	itemImagesInfo[1].param3 = 0.6; // stemY left offset from note upperY
	itemImagesInfo[1].param4 = 0.35; // stemY right offset from note upperY
	setImage(2, "images/WholeNote.svg", new ItemImgInfo(1,1.7, 0, 0));
	setImage(4, "images/Crotchet_rest_alt_plain-svg.svg", new ItemImgInfo(3, 0.32, 0.3, -0.75));
	//setImage(10, "images/UpSingleFlag.svg", new ItemImgInfo(3,0.3 , 1.1,0.4));
	//setImage(11, "images/DownSingleFlag.svg", new ItemImgInfo(3, 0.3, 0, -2 ));
	setImage(20, "images/Sharp.svg", new ItemImgInfo(2.8, 0.3, 0, -0.8));
	itemImagesInfo[20].param1 = 0.9; // Distance from Note
	setImage(21, "images/Flat.svg", new ItemImgInfo(2.6, 0.4, 0, -1.3));
	itemImagesInfo[21].param1 = 0.9; // Distance from Note
	setImage(22, "images/natural.svg", new ItemImgInfo(3.52, 0.25, 0, -1.25));
	itemImagesInfo[22].param1 = 0.9; // Distance from Note
	setImage(50, "images/GClef.svg", new ItemImgInfo(8, 0.37, 0, -2));
	itemImagesInfo[50].param1 = 0; // Y-pos offset compared to G clef
	itemImagesInfo[50].param2 = 0; // Offset of key notation
	setImage(51, "images/FClef.svg", new ItemImgInfo(3.2, 0.9, 0, 0));
	itemImagesInfo[51].param1 = -6; // Y_pos offset compared to G Clef
	itemImagesInfo[51].param2 = -2; // Offset of key notation
	setImage(52, "images/CClef.svg", new ItemImgInfo(4, 1, 0, 0));
	itemImagesInfo[52].param1 = -3; // Y_pos offset compared to G Clef
	itemImagesInfo[52].param2 = -1; // Offset of key notation


	waitForLoaded();

};


var waitForLoaded = function(){
	var allImgLoaded = true;
	for(i = 0; i < imagesCount; i++){
		if(!itemImagesInfo[i].isLoaded){
			allImgLoaded = false;
		}
	}
	var retValue;
	if(!allImgLoaded){ retValue = window.setTimeout(waitForLoaded, 100); }
	else{ viewResize(false); }
};


var setImage = function( index, fileName, imgInfo){
	itemImagesInfo[index] = imgInfo;
	itemImages[index].onload = function(){
		itemImagesInfo[index].isLoaded = true;
	}
	itemImages[index].src = fileName;
};

window.onresize = function(event){
	viewResize(true);
};

var viewResize = function(redraw){
	width = window.innerWidth - 20;
	height = window.innerHeight - 20;
	//width = spacingPx * 100;
	//height = width * Math.sqrt(2);
	canvas.width = width;
	canvas.height = height;
	render(redraw);
};

var render = function(redraw){
	context.scale(drawScale, drawScale);
	if(redraw){ context.clearRect(0, 0, width, height); }
	score.render();
	context.strokeStyle = "black";
	context.font = "10px Baskerville";
	context.textAlign = "left";
	context.fillText(score.title, 50, 50);

};

var renderImage = function(imageNr, leftX, upperY){
	var info = itemImagesInfo[imageNr];
	context.drawImage(itemImages[imageNr],
					  leftX +(spacingPx * info.xBias),
					  upperY + (spacingPx * info.yBias),
					  info.width * spacingPx ,
					  spacingPx * info.scale);
};


var Score = function(){
	// Container class for all data related to one score:
	// Score settings, music, graphic details.
	//
	// What about parts?
	// Need one main score file with all neccessary details for the parts and score
	// The parts are different views of the same data.

	this.systemMeasures = [];
	this.masterStaff;
	this.staffs = [];
	this.parts = [];
	this.qNoteEndPureMusic = 0;
	this.ticksEndPureMusic = 0;

	this.title = "Clusterkolonner ikke iorden";
	this.composer = "W. A. Mozart";
}

Score.prototype.appendMusic = function(pureNoteRest, staffNr){
	var stAtIx = this.staffs[staffNr];
	stAtIx.appendMusic(pureNoteRest);

	// Adjusting the total length accordingly:
	var stAtIxEnd = stAtIx.qNoteEnd * Q_NOTE + stAtIx.ticksEnd;
	if(stAtIxEnd > this.qNoteEndPureMusic * Q_NOTE + this.ticksEndPureMusic){
		this.qNoteEndPureMusic = stAtIx.qNoteEnd;
		this.ticksEndPureMusic = stAtIx.ticksEnd;
	}
	//alert("Length: " + this.qNoteEndPureMusic + " , " + this.ticksEndPureMusic);
};

Score.prototype.addNoteRest = function(noteRest, noteValue, dots, ticksPos, measureNr, staffNr, voiceNr){
	//Ny metode for musikk innsetting.
	//Går inn til riktig staff_measure og setter inn.
	//Vi glemmer Pure Music!!
	this.systemMeasures[measureNr].addNoteRest(noteRest, noteValue, dots, ticksPos, staffNr, voiceNr);

};

Score.prototype.appendMeasures = function(numberOfMeasures){
	var qNoteStartingPoint = 0, ticksStartingPoint = 0;
	// Finding the startpoint for the first measure added:
	for(var i = 0; i < numberOfMeasures; i++){
		// Finding the startpoint of the new Sys Measyre
		if(this.systemMeasures.length > 0){
		var lastMeas = this.systemMeasures[this.systemMeasures.length - 1];
		qNoteStartingPoint = lastMeas.qNoteStartingPoint + Math.floor(lastMeas.totalTicksLength / Q_NOTE);
		ticksStartingPoint = lastMeas.ticksStartingPoint + (lastMeas.totalTicksLength % Q_NOTE);
		qNoteStartingPoint += Math.floor(ticksStartingPoint / Q_NOTE);
		ticksStartingPoint = ticksStartingPoint % Q_NOTE;
		//alert(qNoteStartingPoint + " " + ticksStartingPoint);
	}

		var newSysMes = new SystemMeasure(this.masterStaff, qNoteStartingPoint, ticksStartingPoint);
		this.systemMeasures.push(newSysMes);
		if(this.systemMeasures.length == 1){
			this.systemMeasures[0].showInitTimeSig = true;
		}
		for(var i2 = 0; i2 < this.staffs.length; i2++){
			newSysMes.staffMeasures.push(this.staffs[i2].appendMeasure(newSysMes));

		}
	}
};

Score.prototype.updateMeasures = function(ticksFrom, ticksTo){

	// This function updates the content of the measures in the given range
	// If to = 0 : Updating everythin after qNote/ticks from.

	// 1) Calculate the first affected measures
	// 3) Call the SystemMeasure.update(qNote/ticksStart, lastqNote/tick of prev measure, )
	//    of the relevant measuresi. Append Systemmeasures if neccessary.

	/*
	var sysMeasFirstIx, SysMeasLastIx, sysMeasAtIx, sysMeasAtIxStartingTick, sysMeasAtIxLastTick;
	for(var i = 0; i < this.systemMeasures.length; i++){
		sysMeasAtIx = this.systemMeasures[i];
		sysMeasAtIxStartingTick = sysMeasAtIx.qNoteStartingPoint * Q_NOTE + sysMeasAtIx.ticksStartingPoint;
		sysMeasAtIxLastTick = sysMeasAtIxStartingTick + sysMeasAtIx.qNoteLength * Q_NOTE + sysMeasAtIx.ticksLength;

		//Hvis takten er i intervall:

	}
	*/

};

Score.prototype.sendSysMeasureToParts = function(sysMeasure, sysMeasureNr){
		this.parts[0].receiveSysMeasure(sysMeasure, sysMeasureNr);
};


Score.prototype.addPart = function(){
	this.parts.push(new Part);
};

Score.prototype.buildGraphic = function(){
	this.parts[0].buildGraphic();
};


Score.prototype.render = function(){
	this.parts[0].render();
}


var Part = function(){
	// A Part object represents a part OR the full score.
	this.pages = [];
};

Part.prototype.addPage = function(){
	this.pages.push(new Page());
};

Part.prototype.receiveSysMeasure = function(sysMeasure, sysMeasureNr){
	this.pages[0].receiveSysMeasure(sysMeasure, sysMeasureNr);
};

Part.prototype.buildGraphic = function(){
	this.pages[0].buildGraphic();
};

Part.prototype.render = function(){
	this.pages[0].render(0, 0 , 100 * spacingPx, false);
};

var Page = function(){
	// 	A page object represents one page in the score
	// 	In panorama view there is only one page with adaptive size
	this.widthPx;
	this.heightPx;
	this.leftMargin = 0.06; // 1 is full page width, 0.1 is 1/10 of page width
	this.rightMargin = 0.06;
	this.topMargin = 0.08;
	this.bottomMargin = 0.07;
	this.systems = [];

};

Page.prototype.receiveSysMeasure = function(sysMeasure, sysMeasureNr){
	if(this.systems.length == 0){
		this.systems.push(new System(this));
		this.systems[0].receiveSysMeasure(sysMeasure, sysMeasureNr);
	}
	else{
		if(!this.systems[this.systems.length - 1].receiveSysMeasure(sysMeasure, sysMeasureNr)){
			this.systems.push(new System(this));
			this.systems[this.systems.length - 1].receiveSysMeasure(sysMeasure, sysMeasureNr);
		}
	}
};

Page.prototype.buildGraphic = function(){
	for(var i = 0; i < this.systems.length; i++){
		this.systems[i].buildGraphic();
	}
};

Page.prototype.render = function(leftXPx, topYPx, widthPx, redraw){
	var heightPx = Math.floor(widthPx * Math.sqrt(2));
	var leftMarginPx = leftXPx + widthPx * this.leftMargin;
	var innerWidthPx = widthPx * (1 - this.leftMargin - this.rightMargin);
	var topMarginPx = topYPx + heightPx * this.topMargin;
	var innerHeightPx = heightPx * (1 - this.topMargin - this.bottomMargin);

	// Drawing outline:
	context.strokeStyle = "black";
	context.beginPath();
	context.rect(leftXPx, topYPx, widthPx, heightPx);
	context.stroke();

	// Drawing the margins
	context.setLineDash([5, 5]);
	context.strokeStyle = "#B0B0B0";
	context.beginPath();
	context.rect(leftMarginPx, topMarginPx, innerWidthPx, innerHeightPx);
	context.stroke();
	context.setLineDash([]);


	for(var i = 0; i < this.systems.length; i++){
		this.systems[i].render(leftMarginPx, topMarginPx + (i * spacingPx * systemSpacing), innerWidthPx, innerHeightPx);
	}



};


var System = function(page){
	// A system object represents one system of staffs on the page.
	this.page = page;
	this.systemMeasures = [];
};

System.prototype.receiveSysMeasure = function(sysMeasure, sysMeasureNr){
	if(this.systemMeasures.length < wantedMeasPrSystem){
		this.systemMeasures.push(sysMeasure);
		if(this.systemMeasures.length == 1){
			this.systemMeasures[this.systemMeasures.length - 1].setShowInitKey(true);
			this.systemMeasures[this.systemMeasures.length - 1].setShowInitClef(true);
		}
		return true;
	}
	return false;
};

System.prototype.buildGraphic = function(){
	for(var i = 0; i < this.systemMeasures.length; i++){
		this.systemMeasures[i].buildGraphic();
	}
};

System.prototype.render = function(leftXPx, topYPx, widthPx, redraw){
	var measLeftXPx, measWidthPx;
	measWidthPx = widthPx / this.systemMeasures.length;
	measLeftXPx = leftXPx;
	for(var i = 0; i < this.systemMeasures.length; i++){
		this.systemMeasures[i].render(measLeftXPx, topYPx, measWidthPx, redraw);
		measLeftXPx += measWidthPx;
	}
};



// Measure stores all the staffMeasures in a bar. It keeps track of horizontal spacing of the music
// and all System items connected to one single bar.
var SystemMeasure = function(masterStaff, qNoteStartingPoint, ticksStartingPoint){
	this.masterStaff = masterStaff;
	this.qNoteStartingPoint = qNoteStartingPoint;
	this.ticksStartingPoint = ticksStartingPoint;
	this.totalTicksLength = 0;
	this.staffMeasures = [];
	this.ticks = []; //Stores info about specific ticks: width
	this.leftMarginWidth = 0; // no of spacings.
	this.rightMarginWidth =0; // no of spacings
	this.initClefWidth = 0;
	this.initKeyWidth = 0;
	this.initTimeWidth = 0;
	this.timeSignature;
	this.key;

	this.showInitTimeSig = false;
	this.showInitKey = false;
	this.showInitClef = false;

	this.updateTimeSig();
	this.updateKey();
}

SystemMeasure.prototype.updateTimeSig = function(){
	//alert(this.masterStaff.timeSigs.length);
	this.timeSignature = this.masterStaff.getTimeSignatureAt(this.qNoteStartingPoint, this.ticksStartingPoint);
	this.totalTicksLength = 4 * Q_NOTE * this.timeSignature.topNr / this.timeSignature.botNr;
};

SystemMeasure.prototype.updateKey = function(){
	this.key = this.masterStaff.getKeyAt(this.qNoteStartingPoint, this.ticksStartingPoint);
	//this.key = new Key(6, 0,0);
};

SystemMeasure.prototype.setShowInitKey = function(showBool){
	this.showInitKey = showBool;
	for(var i = 0; i < this.staffMeasures.length; i++){
		this.staffMeasures[i].showInitKey = showBool;
	}
};

SystemMeasure.prototype.setShowInitTimeSig = function(showBool){
	this.showInitTimeSig = showBool;
	for(var i = 0; i < this.staffMeasures.length; i++){
		this.staffMeasures[i].showInitTimeSig = showBool;
	}
};

SystemMeasure.prototype.setShowInitClef = function(showBool){
	this.showInitClef = showBool;
	for(var i = 0; i < this.staffMeasures.length; i++){
		this.staffMeasures[i].showInitClef = showBool;
	}
};


SystemMeasure.prototype.updateTick = function(ticksPos, width){
	var exists = false;
	for(var i = 0; i < this.ticks.length; i++){
		if(this.ticks[i].ticksPos == ticksPos){
			this.ticks[i].width = width;
			exists = true;
			break;
		}
	}
	if(!exists){
		this.ticks.push(new Tick(ticksPos, width));
	}
};

SystemMeasure.prototype.buildGraphic = function(){
	//alert("Building sys mes graphic");
	var staffMeas;
	// Calculating space needed for starting clef, key sign and time sign.
	for(var i = 0; i < this.staffMeasures.length; i++){
		staffMeas = this.staffMeasures[i];
		if(staffMeas.showInitClef){
			var staffInitClefWidth = itemImagesInfo[staffMeas.clefNr].width + (padding * 2);
			if(	staffInitClefWidth > this.initClefWidth ){
				this.initClefWidth = staffInitClefWidth;
			}
		}
		if(staffMeas.showInitKey){
			var accWidth;
			if(staffMeas > 0){
				accWidth = itemImagesInfo[20].width;
			}
			else{
				accWidth = itemImagesInfo[21].width;
			}
			var staffInitKeyWidth = Math.abs(staffMeas.key) * (accWidth + padding);
			if(staffInitKeyWidth > this.initKeyWidth){
				this.initKeyWidth = staffInitKeyWidth;;
			}
		}
		if(staffMeas.showInitTimeSig){
			this.initTimeWidth = 1;
			if(staffMeas.topMeter > 9 || staffMeas.bottomMeter > 9){
				this.initTimeWidth += 0.5;
			}
		}
	}
	this.leftMarginWidth = this.initClefWidth + this.initKeyWidth + this.initTimeWidth;

	for(var i = 0; i < this.staffMeasures.length; i++){
		staffMeas = this.staffMeasures[i];
		staffMeas.buildGraphic();
	}

};

SystemMeasure.prototype.render = function(leftX, topY, width, redraw){
		for(var i = 0; i < this.staffMeasures.length; i++){
		this.staffMeasures[i].render(leftX, topY, width, redraw);
	}
};

SystemMeasure.prototype.addNoteRest = function(noteRest, noteValue, dots, ticksPos, staffNr, voiceNr){
	this.staffMeasures[staffNr].addNoteRest(noteRest, noteValue, dots, ticksPos, voiceNr, true);
};


// Masterstaff contains System info: tempo, repeat, timeSigs, time signature.
var MasterStaff = function(){
	this.keys = [];
	this.timeSigs = [];

};

MasterStaff.prototype.insertTimeSignature = function(newTimeSignature){
	var newTimeSigTotalTicks = newTimeSignature.qNotePos * Q_NOTE + newTimeSignature.ticksPos;
	if(this.timeSigs.length == 0 ||
	   this.timeSigs[this.timeSigs.length-1].qNotePos * Q_NOTE + this.timeSigs[this.timeSigs.length-1].ticksPos < newTimeSigTotalTicks){
		this.timeSigs.push(newTimeSignature);
	}
	else{
		for(var i = 0; i < this.timeSigs.length; i++){
			var timeSigAtIx = this.timeSigs[i];
			if(timeSigAtIx.qNotePos * Q_NOTE + timeSigAtIx.ticksPos == newTimeSigTotalTicks){
				this.timeSigs.splice(i, 1, newTimeSignature);
				break;
			}
			else if(timeSigAtIx.qNotePos * Q_NOTE + timeSigAtIx.ticksPos > newTimeSigTotalTicks){
				this.timeSigs.splice(i, 0, newTimeSignature);
				break;
			}
		}
	}
};

MasterStaff.prototype.getTimeSignatureAt = function(qNotePos, ticksPos){
	var totalTicksPos = qNotePos * Q_NOTE + ticksPos;
	if(this.timeSigs.length == 0){ return null; }
	else{
		var tmpTimeSig;
		for(var i = 0; i < this.timeSigs.length; i++){
			tmpTimeSig = this.timeSigs[i];
			if(totalTicksPos == (tmpTimeSig.qNotePos * Q_NOTE) + tmpTimeSig.ticksPos){
				return tmpTimeSig;
			}
			if(totalTicksPos > (tmpTimeSig.qNotePos * Q_NOTE) + tmpTimeSig.ticksPos){
				if(i == this.timeSigs.length - 1){ return tmpTimeSig; }
				else if(this.timeSigs[i+1].qNotePos * Q_NOTE + this.timeSigs[i+1].ticksPos > totalTicksPos){
					return tmpTimeSig;
				}
			}
		}
	}
};

MasterStaff.prototype.insertKey = function(newKey){
	var newKeyTotalTicks = newKey.qNotePos * Q_NOTE + newKey.ticksPos;
	if(this.keys.length == 0 ||
	   this.keys[this.keys.length-1].qNotePos * Q_NOTE + this.keys[this.keys.length-1].ticksPos < newKeyTotalTicks){
		this.keys.push(newKey);
	}
	else{
		for(var i = 0; i < this.keys.length; i++){
			var keyAtIx = this.keys[i];
			if(keyAtIx.qNotePos * Q_NOTE + keyAtIx.ticksPos == newKeyTotalTicks){
				this.keys.splice(i, 1, newKey);
				break;
			}
			else if(keyAtIx.qNotePos * Q_NOTE + keyAtIx.ticksPos > newKeyTotalTicks){
				this.keys.splice(i, 0, newKey);
				break;
			}
		}
	}
};

MasterStaff.prototype.getKeyAt = function(qNotePos, ticksPos){
	var totalTicksPos = (qNotePos * Q_NOTE) + ticksPos;
	if(this.keys.length == 0){ return null; }
	else{
		var tmpKey;
		for(var i = 0; i < this.keys.length; i++){
			tmpKey = this.keys[i];
			if(totalTicksPos == (tmpKey.qNotePos * Q_NOTE) + tmpKey.ticksPos){
				return tmpKey;
			}
			if(totalTicksPos > (tmpKey.qNotePos * Q_NOTE) + tmpKey.ticksPos){
				if(i == this.keys.length - 1){ return tmpKey; }
				else if(this.keys[i+1].qNotePos * Q_NOTE + this.keys[i+1].ticksPos > totalTicksPos){
					return tmpKey;
				}
			}
		}
	}
};



// Staff contains staff-related info: pureMusic,clefs and other elements which relates to a range of bars.
var Staff = function(masterStaff){
	this.masterStaff = masterStaff;
	this.pureMusic = [];
	this.staffMeasures = [];
	this.clefs = [];
	this.qNoteEnd = 0; //last qNote + tick of pureMusic (or rest)
	this.ticksEnd = 0;
};

/* IKKE I BRUK PR 17 DES 19
Staff.prototype.appendMusic = function(pureNoteRest){
	this.pureMusic.push(pureNoteRest);
	this.qNoteEnd += pureNoteRest.qNoteLength;
	this.qnoteEnd += Math.floor((this.ticksEnd + pureNoteRest.ticksLength) / Q_NOTE);
	this.ticksEnd = (this.ticksEnd + pureNoteRest.ticksLength) % Q_NOTE;
	//alert("Musikk lengde: " + this.qNoteEnd + ", " + this.ticksEnd);
};



Staff.prototype.overwriteMusic = function(pureNoteRest, qNotePos, ticksPos){

};


Staff.prototype.insertMusic = function(pureNoterest, qNotePos, ticksPos){
};
*/

Staff.prototype.appendMeasure = function(systemMeasure){
	//alert(systemMeasure.timeSignature.topNr);
	var topMeter = systemMeasure.timeSignature.topNr;
	var bottomMeter = systemMeasure.timeSignature.botNr;
	var keyNr = systemMeasure.key.keyNr;
	var newStM = new Staff_Measure(topMeter, bottomMeter, keyNr, 50, this, systemMeasure);
	this.staffMeasures.push(newStM);
	return newStM;
};

Staff.prototype.getClefAtPos = function(qNotePos, ticksPos){
	var totalTicksPos = qNotePos * Q_NOTE + ticksPos;
	var clef, clefTotalTicksPos;
	for(var i = 0; i < this.clefs.length; i++){
		clefTotalTicksPos = this.clefs[i].qNotePos * Q_NOTE + this.clefs[i].ticksPos;
		if(i = this.clefs.length - 1 || clefTotalTicksPos > totalTicksPos){
			clef = this.clefs[i - 1];
			break;
		}
	}
	return clef
};



Staff.prototype.insertClef = function(newClef){
	var newClefTotalTicks = newClef.qNotePos * Q_NOTE + newClef.ticksPos;
	if(this.clefs.length == 0 ||
	   this.clefs[this.clefs.length-1].qNotePos * Q_NOTE + this.clefs[this.clefs.length-1].ticksPos < newClefTotalTicks){
		this.clefs.push(newClef);
	}
	else{
		for(var i = 0; i < this.clefs.length; i++){
			var clefAtIx = this.clefs[i];
			if(clefAtIx.qNotePos * Q_NOTE + clefAtIx.ticksPos == newClefTotalTicks){
				this.clefs.splice(i, 1, newClef);
				break;
			}
			else if(clefAtIx.qNotePos * Q_NOTE + clefAtIx.ticksPos > newClefTotalTicks){
				this.clefs.splice(i, 0, newClef);
				break;
			}
		}
	}
};
// S_M
var Staff_Measure = function(topMeter, bottomMeter, key, clefNr, staff, systemMeasure){
	//alert("opprettelse av Staff_Measure");
	this.systemMeasure = systemMeasure;
	this.topMeter = topMeter;
	this.bottomMeter = bottomMeter;
	this.totalTicks = (4 / bottomMeter) * Q_NOTE * topMeter;
	this.key = key;// in fifths from c
	this.clefNr = clefNr; // The initial clef
	this.staff = staff; // To get access to clef list etc.
	//this.systemMeasure = systemMeasure;
	this.pitchOffset = 0;
	this.keyOffset = 0;
	this.showInitClef = this.systemMeasure.showInitClef;
	this.showInitKey = this.systemMeasure.showInitKey;
	this.showInitTimeSig = this.systemMeasure.showInitTimeSig;
	this.staffTicks = []; // a staff tick contains all the noteRests at one particular tick location
	this.noOfVoices;
	this.shortestInBarTicks = 0;
	// graph_items stores all graphical items in the bar and their positioning info:
	this.graph_items = [];
	this.leftMarginWidth = 0;
	this.rightMarginWidth = 0;
	this.innerWidth = 0;
	this.noteToYPos = [12];
	this.initCScaleSteps = [7]; // index 0 = C. The chrom nr of each c scale step with acc.
	this.tmpCScaleSteps = []; // Modified scales as a result of temporary accidentals.
	this.tmpAccidentals = [];

	this.updateCScaleSteps();
	this.updateNoteToYPosTable();

	this.voiceBeamGroups = []; // A beamgroup is a potential 8th note beam. The groups are according to the time signature.
	this.findGapsInVoices();
};

Staff_Measure.prototype.updateCScaleSteps = function(){
	this.cScaleSteps = [0, 2, 4, 5, 7, 9, 11];
	if(this.key > 0){
		for(i = 0; i < this.key; i++){
			this.cScaleSteps[(((i + 1) * 4) - 1) % 7] += 1;
		}
	}
	else if(this.key < 0){
		for(i = 0; i < -this.key; i++){
			this.cScaleSteps[(((i + 1) * 3) + 3) % 7] -= 1;
		}
	}
};

Staff_Measure.prototype.updateNoteToYPosTable = function(){
	var i;
	for(i = 0; i < 12; i++){
		this.noteToYPos[i] = NOTENR_Y_OFFSET[i];
	}
	if(this.key > 0){
		for(i = 7; i < this.key + 8; i++){
			var keyOffsets = KEYS_Y_OFFSET[i];
			this.noteToYPos[keyOffsets[0]] = keyOffsets[1];
			this.noteToYPos[keyOffsets[2]] = keyOffsets[3];
		}
	}
	else if(this.key < 0){
		for(i = 7; i > 6 + this.key; i--){
			var keyOffsets = KEYS_Y_OFFSET[i];
			this.noteToYPos[keyOffsets[0]] = keyOffsets[1];
			this.noteToYPos[keyOffsets[2]] = keyOffsets[3];
		}
	}

};


// Inserting a note or rest. ticksFromStart = ticks from start of bar.
// var NoteRest = function(isNote, noteNr){
Staff_Measure.prototype.addNoteRest = function(noteRest, noteValue, dots, ticksPos, voiceNr, createTimeGap){
	if(createTimeGap){ this.createTimeGapInVoice(noteValue, dots, ticksPos, voiceNr) };
	var i;
	if(this.staffTicks.length == 0 || ticksPos > this.staffTicks[this.staffTicks.length-1].ticksPos){
		var st = new StaffTick(ticksPos);
		this.staffTicks.push(st);
		st.addNoteRest(noteRest, noteValue, dots, voiceNr);
	}
	else{
		for(i = 0; i < this.staffTicks.length; i++){
			if(ticksPos <  this.staffTicks[i].ticksPos){
				var st = new StaffTick(ticksPos);
				this.staffTicks.splice(i, 0, st);
				this.staffTicks[i].addNoteRest(noteRest, noteValue, dots, voiceNr);
				break;
			}
			else if(ticksPos == this.staffTicks[i].ticksPos){
				this.staffTicks[i].addNoteRest(noteRest, noteValue, dots, voiceNr);
			}
		}
	}
	//this.findGapsInVoices();
	console.log("historyStack.length: " + historyStack.length);
};

Staff_Measure.prototype.addNoteRestTicksLength = function(isNote, noteNr, ticksLength, ticksPos, voiceNr){
	// This method inserts one or more noteRests based on the ticksLength.
	// Inserts several noteRests after one another if neccessary (tied if notes)
	// Adapts notelengths to Beamgroups
	// Calls next staff_measure if crossing barline.

	var lastTick = ticksPos + ticksLength - 1;
	var noteValues = [];
	var infLoopBreaker = 0;

	while(ticksLength > 0){
		infLoopBreaker += 1;
		noteValues.push(noteValueFromTicks(ticksLength));
		ticksLength = noteValues[noteValues.length - 1].remainder;
		if(infLoopBreaker > 1000){ alert("**ERROR in addNoteR W Ticks**"); break; }
	}

	var nv;
	for(i = noteValues.length - 1; i >= 0; i--){
		nv = noteValues[i];
		this.addNoteRest(new NoteRest(isNote, noteNr), nv.noteValue, nv.dots, ticksPos, voiceNr, false);
		//console.log("Addet med ticksLength: fra tick: " + ticksPos + " lengde: " + nv.noteValue + "Dots:" + nv.dots + " Er Note: " + isNote);
		ticksPos += ticksFromNoteValueDots(nv.noteValue, nv.dots);
	}
};


Staff_Measure.prototype.removeNoteRest = function(noteRest, ticksPos, voiceNr){
	var staffTick, voiceTick;
	for(var staffTickIx = 0; staffTickIx < this.staffTicks.length; staffTickIx++){
		staffTick = this.staffTicks[staffTickIx];
		if(staffTick.ticksPos == ticksPos){
			staffTick.removeNoteRest(noteRest, voiceNr);
			var empty = true;
			for(var i = 0; i < staffTick.voiceTicks.length; i++){
				if(staffTick.voiceTicks[i] != undefined){ empty = false; break;}
			}
			if(empty){ this.staffTicks.splice(i, 1); }
		}
		else if(staffTick.ticksPos > ticksPos){ break; }
	}
};

Staff_Measure.prototype.findVoiceBeamGroupAtTicksPos = function(voiceNr, ticksPos){
	var tempBG;
	for(i = 0; i < this.voiceBeamGroups[voiceNr].length; i++){
		tempBG = this.voiceBeamGroups[voiceNr][i];
		if(tempBG.fromTick <= ticksPos && tempBG.toTick > ticksPos){
			return tempBG;
		}
	}
	return undefined;
};

Staff_Measure.prototype.addTmpAcc = function(tmpA){
	if(this.tmpAccidentals.length == 0 || tmpA.ticksPos >= this.tmpAccidentals[this.tmpAccidentals.length-1].ticksPos){
		this.tmpAccidentals.push(tmpA);
	}
	else{
		var i;
		for(i = 0; i < this.tmpAccidentals.length; i++){
			if(tmpA.ticksPos <= this.tmpAccidentals[i].ticksPos){
				this.tmpAccidentals.splice(i, 0, tmpA);
			}
		}
	}
}

// BUILD
//Method to be called when a staff measure has been created or edited:
Staff_Measure.prototype.buildGraphic = function(){
	this.pitchOffset = itemImagesInfo[this.clefNr].param1;
	this.keyOffset = itemImagesInfo[this.clefNr].param2;

	// Clearing before rebuilding:
	this.graph_items = [];

	// Adding initial clef
	if(this.showInitClef){
		this.graph_items.push(new GraphicItem(this.clefNr, 1, padding, 0));
	}


	//Intial key signature:
	if(this.showInitKey){
		var clefOffset = - itemImagesInfo[this.clefNr].param2 * 0.5;
		var keyX = this.systemMeasure.initClefWidth;
		if(this.key > 0){
			// key is sharp:
			var i, tmpY;
			var sharpWidth = itemImagesInfo[20].width;
			for(i = 0; i < this.key; i++){
				if(i % 2 == 0){
					tmpY =  -0.5 - (i * 0.25);
					if(i > 3){ tmpY += 3.5; }
					this.graph_items.push(new GraphicItem(20, 1, keyX + (sharpWidth * i) + (padding * i), tmpY + clefOffset));
				}
				else{
					this.graph_items.push(new GraphicItem(20, 1,  keyX + (sharpWidth * i) + (padding * i), 1.25 - (i * 0.25)+ clefOffset ));
				}
			}
		}
		else{
			// key is flat:
			var i;
			var flatWidth = itemImagesInfo[21].width;
			for(i = 0; i < (-1 * this.key); i++){
				if(i % 2 == 0){
					this.graph_items.push(new GraphicItem(21, 1,  keyX + (flatWidth * i) + (0.5 * padding * i),
							                              i * 0.25 + clefOffset + 1.5 ));
				}
				else{
					this.graph_items.push(new GraphicItem(21, 1, keyX + (flatWidth * i) + (0.5 *padding *i), -0.25 + (i * 0.25) + clefOffset ));
				}

			}
		}

	}

	if(this.showInitTimeSig){
		var timeSigX = this.systemMeasure.initClefWidth + this.systemMeasure.initKeyWidth;
		this.graph_items.push(new GraphicTimeSignature(this.topMeter, this.bottomMeter, 1, timeSigX, 0));
	}

	//musicItems
	var staffTick, voiceTick, noteRest;
	this.noOfVoices = 0;
	for(staffTickIx = 0; staffTickIx < this.staffTicks.length; staffTickIx++){
		staffTick = this.staffTicks[staffTickIx];
		if(this.noOfVoices < staffTick.voiceTicks.length){ this.noOfVoices++; }
		for(voiceTickIx = 0; voiceTickIx < staffTick.voiceTicks.length; voiceTickIx++){
			voiceTick = staffTick.voiceTicks[voiceTickIx];
			voiceTick.avgYpos = 0;
			for(noteRestIx = 0; noteRestIx < voiceTick.noteRests.length; noteRestIx++){
				noteRest = voiceTick.noteRests[noteRestIx];
				if(noteRest.isNote){
				// Is a note, not a rest
					if(voiceTick.noteValue < 7){
						noteRest.imgNr = 0;
					}
					else if(voiceTick.noteValue < 8 ){
						noteRest.imgNr = 1;
					}
					else{ noteRest.imgNr = 2; }
				}
				else{
					//Is a rest
				}

				var noteOct = Math.floor(noteRest.noteNr / 12); //Middle octave is 5.
				var noteStep = noteRest.noteNr - (noteOct * 12); // C = 0..B = 11
				var noteScaleStep = C_SCALE_FROM_CHROM[noteStep];// 0 - 6, Semitones has value *.5
				noteRest.Ypos = this.noteToYPos[noteStep];
				// Notes between scale steps is has notPosValue of *.5.
				// Actual step is beeing calculated along with accidentals below


				// *** HER MÅ DET VÆRE EN KLAR STRUKTUR:
				// 			Dersom ingen ønsker i noteRest:
				//			Hva med ranking av nærmeste trinn?
				//			Eks: skal sette inn F etter E og F#(løst fortegn)
				//			Finner at current closest er E og F#, velger en av de.
				//			Dersom noteRest er i opprinnelig toneart velges trinn deretter
				//			Siden F er i opprinnelig toneart velges den.
				//			utover det velges iht gjelden toneart, # eller b-toneart.

				// Calculate accidental
				// Sjekker nærmeste toner og rangerer etter hvor langt unna de er:


				var noteNeedNoAcc = false;
				var accNeeded = 99;
				for(i = 0; i < 7; i++){
					if(noteStep == this.cScaleSteps[i]){
						var i2;
						noteNeedNoAcc = true;
						for(i2 = this.tmpAccidentals.length - 1; i2 >= 0; i2--){
							var tmpA = this.tmpAccidentals[i2];
							if(tmpA.ticksPos <= noteRest.ticksPos && i == tmpA.cScaleStep){
								noteNeedNoAcc = false;
								alert("Scalestep " + i +" has prev loose acc");
								break;
							}
						}
						break;
					}
				}


				if(!noteNeedNoAcc){
					//notePosX += (padding * spacingPx);
					// Note is not in key, accidental must be set:
					if(noteRest.blwabv == 0){
						if(noteIsInCScale(noteStep)){
							// Note can be set to natural:
							noteRest.shownAcc = 0;
							//this.addTmpAcc(new TmpAcc(noteRest.ticksPos, noteScaleStep, 0));
							if(this.key > 0){ noteRest.Ypos -= 0.25; }
							else{ noteRest.Ypos += 0.25; }
						}
						else if(this.key > 0){
							noteRest.shownAcc = 1;
							//this.addTmpAcc(new TmpAcc(noteRest.ticksPos, noteScaleStep - 0.5 , 1));
							noteRest.Ypos += 0.25;
						}
						else{
							noteRest.shownAcc = -1;
							//this.addTmpAcc(new TmpAcc(noteRest.ticksPos, noteScaleStep + 0.5, -1));
							noteRest.Ypos -= 0.25;
						}
					}
				}

				noteRest.Ypos -= ((noteOct - 6) * 3.5);
				noteRest.Ypos += itemImagesInfo[this.clefNr].param1; //Adapt to current clef


				if(noteRest.isNote){
					// Calculating stem:
					if(voiceTick.noteValue < 8){

						var info = itemImagesInfo[0];
						noteRest.stemLength = -3;
						if(noteRest.Ypos <= 1.5){ noteRest.stemLength = 4; }
						if(noteRest.Ypos > 4.5 || noteRest.Ypos < -1.5){
							noteRest.stemLength = 2 - noteRest.Ypos;
						}
						//alert("Stem length = " + noteRest.stemLength);

						//Setting startpoint of stem (as offset from note pos)
						if(noteRest.stemLength > 0){
							noteRest.stemXoffset = itemImagesInfo[noteRest.imgNr].param1;
							noteRest.stemYoffset = itemImagesInfo[noteRest.imgNr].param3;
						}
						else{
							noteRest.stemXoffset = itemImagesInfo[noteRest.imgNr].param2;
							noteRest.stemYoffset = itemImagesInfo[noteRest.imgNr].param4;
						}
						noteRest.stemLength -= noteRest.stemYoffset;
					}
				}
				else{

					if(voiceTick.noteValue >= 7){	}
				}
			}//noteRests

			voiceTick.calcAverageYpos();
			this.setNotesXposCode(voiceTick);
		}//VoiceTicks
	}//staffTicks

	// Building the beams:
	this.buildBeams();
};

// This method sets the correct x position of notes in a voice tick.
// Takes care of unisons and seconds and sets the XposCode in the noteRests.
Staff_Measure.prototype.setNotesXposCode = function(voiceTick){
	if(voiceTick.noteRests.length > 1){
		if(voiceTick.noteRests.length == 2){
			// Check if second or unison.
			// Set the upper note to the right side, Check for stem direction!
			if(Math.abs(voiceTick.noteRests[0].Ypos - voiceTick.noteRests[1].Ypos) < 1){
				if(voiceTick.avgYpos >= HIGHEST_UPSTEM_YPOS){
					voiceTick.noteRests[0].XposCode = 0;
					voiceTick.noteRests[1].XposCode = 1;
				}
				else{
					voiceTick.noteRests[0].XposCode = 1;
					voiceTick.noteRests[1].XposCode = 0;
				}
			}
			else{
				voiceTick.noteRests[0].XposCode = 0;
				voiceTick.noteRests[1].XposCode = 0;
			}
		}
		else{
			// Three notes or more, define main (index 0) and alternative note columns:
			var columns = []; // An array of column arrays.
			columns[0] = [];
			var columnsYposBiases = [];; // An array with the Ypos value of the lowest note in the column.
			var nrAtIx,nrAtPrevIx;
			for(var i = 0; i < voiceTick.noteRests.length; i++){
				nrAtIx = voiceTick.noteRests[i];
				if(i == 0){
				nrAtIx.XposCode = 0;
				columns[0].push(nrAtIx);
				columnsYposBiases.push(nrAtIx.Ypos);

				}
				else{
					if(i > 0 && nrAtPrevIx.Ypos - nrAtIx.Ypos < 1){
						// CONFLICT: Find first availiable column, create new column if needed
						var noteSlotFound = false;
						for(var i2 = 0; i2 < columns.length; i2++){
							if(columns[i2][Math.floor(columnsYposBiases[i2] - nrAtIx.Ypos)] == undefined){
								if(columns[i2][Math.floor(columnsYposBiases[i2] - nrAtIx.Ypos) - 1] == undefined ||
								   columns[i2][Math.floor(columnsYposBiases[i2] - nrAtIx.Ypos) - 1].Ypos - nrAtIx.Ypos > 0.5){
									// Availiable slot in existing column:
									nrAtIx.XposCode = i2;
									columns[i2][Math.floor(columnsYposBiases[i2] - nrAtIx.Ypos)] = nrAtIx;
									noteSlotFound = true;
									break;
								}
							}

						}
						if(!noteSlotFound){
							// Must create new column, then push noteRest:
							var newColumn = [];
							columnsYposBiases.push(nrAtIx.Ypos);
							nrAtIx.XposCode = columns.length;
							newColumn.push(nrAtIx);
							columns.push(newColumn);
							//alert("New c created, columns length: " + columns.length + "new colum length: " + newColumn.length);
						}
					}
					else{
						// No conflict between this and lower note:
						nrAtIx.XposCode = 0;
						columns[0][Math.floor(columnsYposBiases[0] - nrAtIx.Ypos)] = nrAtIx;
					}
				}
				nrAtPrevIx = nrAtIx;
			}
		}

	}
	else{ voiceTick.noteRests[0].XposCode = 0; }
};

// This function creates the beamGroups
Staff_Measure.prototype.buildBeams = function(){
	//alert("building beams");
	this.voiceBeamGroups = [];

	// Creating the beamGroups based on the time signature in the Sys Measure:
	var nextStartTick = 0, currentBeamGroup;
	for(var v = 0; v < this.noOfVoices; v++){
		this.voiceBeamGroups[v] = [];
		for(var i = 0; i < this.systemMeasure.timeSignature.beamGroups.length; i++){
			var currentBeamGroup = new BeamGroup(nextStartTick, nextStartTick + this.systemMeasure.timeSignature.beamGroups[i]);
			for(var staffTickIx = 0; staffTickIx < this.staffTicks.length; staffTickIx++){
				var staffTick = this.staffTicks[staffTickIx];
				if(staffTick.ticksPos >= currentBeamGroup.fromTick && staffTick.ticksPos < currentBeamGroup.toTick){
					currentBeamGroup.voiceTicks.push(staffTick.voiceTicks[v]);
					//alert("Pusher voiceTick inn i BeamGroup, antal vTicks er nå: " + currentBeamGroup.voiceTicks.length);
				}
				// This can be made quicker by not going through alle staffticks every time
			}
			currentBeamGroup.buildBeams();
			this.voiceBeamGroups[v].push(currentBeamGroup);
			//alert("Build beams: ant beamgrupper ett ny push: " + this.voiceBeamGroups[v].length);

		nextStartTick += this.systemMeasure.timeSignature.beamGroups[i];
		}

	}
};

// Creates a time gap in a voice in order to overwrite with a new voiceTick:
Staff_Measure.prototype.createTimeGapInVoice = function(noteValue, dots, ticksPos, voiceNr){
	//console.log("createTimeGapInVoice");
	var toTick;
	if(noteValue == 99){
		toTick = this.totalTicks - 1;
	}
	else{
			var toTick = ticksPos + ticksFromNoteValueDots(noteValue, dots) - 1;
	}
	var staffTick, voiceTick, vtEndTick;
	// Checking if overlapping voiceTicks exists,
	for(var staffTickIx = 0; staffTickIx < this.staffTicks.length; staffTickIx++){
		//console.log("staffTicksIx = " + staffTickIx);
		staffTick = this.staffTicks[staffTickIx];
		//console.log("voiceTicks.length: " + staffTick.voiceTicks.length);
		if(staffTick.voiceTicks.length > voiceNr && staffTick.voiceTicks[voiceNr] != undefined){
			//console.log("Vi har en voiceTick!");
			voiceTick = staffTick.voiceTicks[voiceNr];
			if(voiceTick.noteValue == 99){
				vtEndTick = this.totalTicks - 1;
			}
			else{
					vtEndTick = staffTick.ticksPos + ticksFromNoteValueDots(voiceTick.noteValue, voiceTick.dots) - 1;
			}
			//console.log("Ny fromTick: " + ticksPos + " Ny to: " + toTick +
			//						"gml fra: " + staffTick.ticksPos + " til: " + vtEndTick +
			//						"ny verdi: " + noteValue + " gml verdi " + voiceTick.noteValue + ":");
			if(staffTick.ticksPos >= ticksPos && vtEndTick <= toTick){
				//console.log("Old voiceTick is inside gap: remove old!");
				staffTick.voiceTicks[voiceNr] = undefined;
				var empty = true;
				for(var i = 0; i < staffTick.voiceTicks.length; i++){
					if(staffTick.voiceTicks[i] != undefined){ empty = false; break; }
				}
				if(empty){ this.staffTicks.splice(staffTickIx, 1); }
			}
			else if(staffTick.ticksPos < ticksPos && vtEndTick >= ticksPos && vtEndTick <= toTick){
				//console.log("End only of old voiceTick is inside the gap: Shorten.");
			}
			else if(staffTick.ticksPos >= ticksPos && staffTick.ticksPos <= toTick && vtEndTick > toTick){
				//console.log("Beginning only of old vt is inside gap: move and shorten.:");
				var noteRest;
				for(var i = 0; i < voiceTick.noteRests.length; i++){
					noteRest = voiceTick.noteRests[i];
					//console.log(" Inserted a shortened noteRest, length: " + (vtEndTick - toTick) + "vtEndtick:" + vtEndTick + " toTick:" + toTick);
					this.addNoteRestTicksLength(noteRest.isNote, noteRest.noteNr, vtEndTick - toTick, toTick + 1, voiceNr);
				}
				// Removing old voiceTick, and staffTick if empty:
				staffTick.voiceTicks[voiceNr] = undefined;
				//console.log("VoiceNR = " + voiceNr + " st.vTs(voiceNr)= " + staffTick.voiceTicks[voiceNr]);
				var empty = true;
				for(var i = 0; i < staffTick.voiceTicks.length; i++){
					if(staffTick.voiceTicks[i] != undefined){ empty = false; break; }
				}
				if(empty){ this.staffTicks.splice(staffTickIx, 1); }
			}
			else if(ticksPos > staffTick.ticksPos && toTick < vtEndTick){
				//console.log("Gap is inside old Vt: Shorten, copy/move/adjust length.");
			}

		}
	}
};

Staff_Measure.prototype.findStaffTickAtTick = function(ticksPos){
	var tmpStaffTick;
	for(var i = 0; i < this.staffTicks.length; i++){
		tmpStaffTick = this.staffTicks[i];
		if(tmpStaffTick.ticksPos == ticksPos){
			return tmpStaffTick;
		}
		else{
			if(tmpStaffTick.ticksPos > ticksPos){ break; }
		}
	}
	return undefined;
};

// This method finds gaps in the voice which should be filled with rests:
Staff_Measure.prototype.findGapsInVoices = function(){
	if(this.staffTicks.length == 0){
		this.fillVoiceGapWithRest(0, 0, this.totalTicks);
	}
	else{
		var staffTick, voiceTick, ticksGapStart, ticksGapEnd;
		for(var voiceIx = 0; voiceIx < this.noOfVoices; voiceIx++){
			ticksGapStart = 0; ticksGapEnd = 0;
			for(var staffTickIx = 0; staffTickIx < this.staffTicks.length; staffTickIx++){
				staffTick = this.staffTicks[staffTickIx];
				if(staffTick.voiceTicks.length >= voiceIx + 1){
					ticksGapEnd = staffTick.ticksPos;
					if(ticksGapEnd - ticksGapStart > 0){
						this.fillVoiceGapWithRest(voiceIx, ticksGapStart, ticksGapEnd);
						//console.log("Fill w v gaps requested from " + ticksGapStart + " to " + ticksGapEnd);
					}
					voiceTick = staffTick.voiceTicks[voiceIx];
					ticksGapStart = ticksGapEnd + Q_NOTE * Math.pow(2, 6 - voiceTick.noteValue);
				}
			}
		}
	}

};

Staff_Measure.prototype.fillVoiceGapWithRest = function(voiceNr, ticksStart, ticksEndExclusive){
	if(ticksStart == 0 && ticksEndExclusive == this.totalTicks){
		this.addNoteRest(new NoteRest(false, 71), 99, 0, 0, 0, false);
	}
	else{
		// Finn pauseverdier som tilsammen fyller gap.
		// Sett inn minste verdier først, deretter større.
		// Pauser deles opp iht beamgrupper
		var firstBeamGroupIx, lastBeamGroupIx, tempBG;
		for(var i = 0; i < this.voiceBeamGroups[voiceNr].length; i++ ){
			tempBG = this.voiceBeamGroups[voiceNr][i];
			//console.log("fillWithRests, i: " + i + ", tempBG from vt: " + tempBG.fromTick + " to: " + tempBG.toTick);
			if(ticksStart >= tempBG.fromTick && ticksStart <= tempBG.toTick){
				firstBeamGroupIx = i;
			}
			if(ticksEndExclusive >= tempBG.fromTick && ticksEndExclusive <= tempBG.toTick){
				lastBeamGroupIx = i;
				break;
			}
		}
		if(firstBeamGroupIx == lastBeamGroupIx){
			// Pause = end - start.
			//OBS: Beamgrupper kan være lengre enn punktert helpause.(?)

		}
		else{
			// First: Pause fra startTick til ut gruppen.
			for(var i = firstBeamGroupIx + 1; i <= lastBeamGroupIx - 1; i++){
				// pause hele beamGruppen
			}
			// Siste: pause fram til endTick
		}


	}
		//this.addNoteRest(noteRest, noteValue, dots, ticksStart, voiceNr);
};


// RND
// leftX,topX indicates the point where the start of the upper staffline is.

// Method to be called if a bar needs to be redrawn:
// It is new, it has been edited or the view  has been changed..
Staff_Measure.prototype.render = function(leftX, topY, width, redraw){
	// Redraw is true if Staff_Measure is has been drawn before
	// lines:
	//
	context.strokeStyle = "black";
	var lineW = spacingPx/50;
	if(lineW < 1){lineW = 1};
	context.lineWidth = lineW;
	var lineNr;
	for(lineNr = 0; lineNr < 5; lineNr++){
		context.beginPath();
		context.moveTo(leftX, topY + (lineNr * spacingPx));
		context.lineTo(leftX + width, topY + (lineNr * spacingPx));
		context.stroke();
	}
	//barline:
	context.beginPath();
	context.moveTo(leftX + width, topY);
	context.lineTo(leftX + width, topY + (4 * spacingPx));
	context.stroke();

	// rendering of items in graph_items
	var i, grItem;
	for(i = 0; i < this.graph_items.length; i++){
		grItem = this.graph_items[i];
		if(grItem.type == "image"){
			if( grItem.posRef == 0){}
			else{
				renderImage(grItem.imgNr, leftX + grItem.leftX * spacingPx, topY + grItem.upperY * spacingPx);
			}
		}
		else if(grItem.type == "time signature"){
			var tsX, tsUpperNrY,tsLowerNrY;
			var fontSizePx = spacingPx * 2.4;
			if( grItem.posRef == 0 ){}
			else{
				tsX = leftX + grItem.leftX * spacingPx;
				tsUpperNrY = topY + grItem.upperY * spacingPx + fontSizePx;
				context.font = "bold " + fontSizePx + "px Times New Roman";
				context.textBaseline = "bottom";
				context.fillText(grItem.topNr,tsX, tsUpperNrY);
				tsLowerNrY = tsUpperNrY - fontSizePx * 0.3;
				context.textBaseline = "top";
				context.fillText(grItem.botNr, tsX, tsLowerNrY);
			}
		}
	}


	// NoteRest drawing
	var innerLeftX = leftX + this.systemMeasure.leftMarginWidth * spacingPx + spacingPx;
	var innerRightX = leftX + width - this.systemMeasure.rightMarginWidth * spacingPx - spacingPx;
	var innerWidth = innerRightX - innerLeftX;
	var prevNoteRest, ticksGap, ticksGapPosX;

	var staffTick, voiceTick, noteRest;
	for(var staffTickIx = 0; staffTickIx < this.staffTicks.length; staffTickIx++){
		staffTick = this.staffTicks[staffTickIx];
		for(var voiceTickIx = 0; voiceTickIx < staffTick.voiceTicks.length; voiceTickIx++){
			voiceTick = staffTick.voiceTicks[voiceTickIx];
			for(var noteRestIx = 0; noteRestIx < voiceTick.noteRests.length; noteRestIx++){
				noteRest = voiceTick.noteRests[noteRestIx];

				var notePosX = innerLeftX + (innerWidth / this.totalTicks) * staffTick.ticksPos;

				// Adjusting the notePosX based on the noteRest.XposCode setting:
				if(noteRest.XposCode != 0){
					if(voiceTick.avgYpos >= HIGHEST_UPSTEM_YPOS){
						//upstem: main column to the left of the stem
						notePosX += noteRest.XposCode * itemImagesInfo[noteRest.imgNr].width * spacingPx * 0.9;
					}
					else{
						//downstem: main column to the right of the stem. Additional columns further to the right.
						if(noteRest.XposCode == 1){
							notePosX -= noteRest.XposCode * itemImagesInfo[noteRest.imgNr].width * spacingPx * 0.9;
						}
						else{
							notePosX += (noteRest.XposCode - 1) * itemImagesInfo[noteRest.imgNr].width * spacingPx * 0.9;
						}
					}
				}

				// NEW rendering: Using params already defined in noteRest:
				var notePosY = topY + (noteRest.Ypos * spacingPx);
				// Notes between scale steps is has notPosValue of *.5.
				// Actual step is beeing calculated along with accidentals below
				if(noteRest.isNote){

					// noteRest is a note, NOT a rest:
					// Rendering the stem:


					var info = itemImagesInfo[noteRest.imgNr];

					//Drawing ledger lines:
					var staffLowY = topY + 4 * spacingPx;
					var ledgeDelta = 1.35;
					if(voiceTick.noteValue <= 8){ ledgeDelta = 1.73; }
					if(notePosY > staffLowY){
						var noOfLines = 0.5 + ((notePosY - staffLowY) / spacingPx);
						context.lineWidth = lineW;
						context.beginPath();
						for(i = 1; i <= noOfLines; i++){
							context.moveTo(notePosX - info.param1 * spacingPx - spacingPx * 0.4,  staffLowY + i * spacingPx);
							context.lineTo(notePosX + spacingPx * ledgeDelta, staffLowY + i * spacingPx);
						}
						context.stroke();
					}
					else if(notePosY < topY - spacingPx){
						var noOfLines = ((topY - notePosY) / spacingPx) - 0.5;
						context.lineWidth = lineW;
						context.beginPath();
						for(i = 1; i <= noOfLines; i++){
							context.moveTo(notePosX - info.param1 * spacingPx - spacingPx * 0.4, topY - i * spacingPx);
							context.lineTo(notePosX + spacingPx * ledgeDelta, topY - i * spacingPx);
						}
						context.stroke();
					}
					// Rendering the notehead
					renderImage(noteRest.imgNr, notePosX, notePosY);
					noteRest.XposPx = notePosX;
					noteRest.YposPx = notePosY;
				}
				else{
					// noteRest is a rest:
					this.renderRest(voiceTick.noteValue, voiceTick.dots, notePosX, notePosY, innerLeftX, innerWidth);

					/*
					if(voiceTick.noteValue >= 7){
						if(voiceTick.noteValue >= 8){

						}
						else{
							context.fillRect(notePosX, topY + spacingPx * 1.5, spacingPx, spacingPx / 2);
						}
					}
					*/
				}

				var prevNoteRest = noteRest;
				//Rendering the dots. MISSING: Cluster columns adjustments.
				for(var i = 0; i < voiceTick.dots; i++){
					context.beginPath();
					//alert("PosY = " + noteRest.Ypos);
					var dotPosX;
					var deltaDotPosY = spacingPx * 0.5;
					if(noteRest.Ypos != Math.floor(noteRest.Ypos)){ deltaDotPosY = 0; }
					if(noteRest.imgNr != undefined){
						dotPosX = notePosX + itemImagesInfo[noteRest.imgNr].width *
													itemImagesInfo[noteRest.imgNr].height * spacingPx +
													spacingPx * 0.5 * (i + 1);
					}
					else{
						if(!noteRest.isNote){
							//Is a rest without an image file:
							{
								if(voiceTick.noteValue == 7 || voiceTick.noteValue == 8){
									dotPosX = notePosX + spacingPx + spacingPx * 0.5 * (i + 1);
								}
								else if(voiceTick.noteValue == 6){
									dotPosX = notePosX + spacingPx + spacingPx * 0.5 * (i + 1);
								}
								else if(voiceTick.noteValue < 6){
									dotPosX = notePosX + spacingPx + spacingPx * 0.5 * (i + 1);
								}
							}
						}
					}
					context.arc(dotPosX, notePosY + deltaDotPosY, spacingPx/6, 0, 2 * Math.PI);
					context.fill();
					context.stroke();
				}
			}
		}
	}

	/*
	// Filling in with bar rests:
	if(this.staffTicks.length == 0){
		context.fillRect(innerLeftX + innerWidth/2 - spacingPx / 2, topY + spacingPx, spacingPx, spacingPx / 2);
	}
	*/
	this.renderBeamsFlagsStems();

};

Staff_Measure.prototype.renderBeamsFlagsStems = function(){

	// Draw stem/flag on unbeamed notes:
	var staffTick, stemDir = -1;
	for(var stIx = 0; stIx < this.staffTicks.length; stIx++){
		staffTick = this.staffTicks[stIx];
		var vt;
		for(var vtIx = 0; vtIx < staffTick.voiceTicks.length; vtIx++){
			vt = staffTick.voiceTicks[vtIx];
			if(vt.noteRests[0].isNote){
				//alert(vt.isBeamed);
				if(!vt.isBeamed && vt.noteValue < 8){

					// Setting stemDir;
					if(vt.forcedStemDir != 0){
						stemDir = vt.forcedStemDir;
					}
					else{
						if(staffTick.voiceTicks.length > 1){
							// More than one voice, stemDir set by voiceNr
							if(vtIx % 2 != 0){ stemDir = 1; } else{ stemDir = -1;  }
						}
						else{
							if(vt.avgYpos >= HIGHEST_UPSTEM_YPOS){
								stemDir = -1;
							}
							else{
							//	alert(vt.avgYpos);
								stemDir = 1;
							}
						}
					}
					var rootNote, spanNote, stemXpx, stemYstartPx;
					//stem is rooted in rootNotem The spanNote is the other extreme of the voiceTick.
					if(stemDir < 0){
						rootNote = vt.noteRests[0];
						spanNote = vt.noteRests[vt.noteRests.length - 1];
						var rootInfo = itemImagesInfo[rootNote.imgNr];
						stemXpx = rootNote.XposPx + rootInfo.param2 * spacingPx;
						stemYstartPx = rootNote.YposPx + rootInfo.param4 * spacingPx;
					}
					else{
						rootNote = vt.noteRests[vt.noteRests.length - 1];
						spanNote = vt.noteRests[0];
						var rootInfo = itemImagesInfo[rootNote.imgNr];
						//console.log("stIx: " + stIx + "rootNote: " + rootNote.isNote + " noteNr: " + rootNote.noteNr + "ticksPos: " + staffTick.ticksPos);
						stemXpx = rootNote.XposPx + rootInfo.param1 * spacingPx;
						stemYstartPx = rootNote.YposPx + rootInfo.param3 * spacingPx;

					}

					//Setting stemlength unbeamed notes
					var stemLength = 3;
					if(spanNote.Ypos < -2 && stemDir > 0){
						stemLength += (-1 * (spanNote.Ypos + 2));
					}
					else if(spanNote.Ypos > 5 && stemDir < 0){
						stemLength += (spanNote.Ypos - 5);
					}

					var stemYendPx = spanNote.YposPx + stemDir * stemLength * spacingPx;
					if(stemDir > 0) stemYendPx += spacingPx;
					if(stemW < 1){ stemW = 1; };

					// Drawing stem unbeamed notes:
					context.lineWidth = stemW;
					context.beginPath();
					context.moveTo(stemXpx, stemYstartPx);
					context.lineTo(stemXpx, stemYendPx);
					context.stroke();

					var stemYspanPx = spanNote.YposPx - (0.5 * stemDir * spacingPx)
					if(vt.noteValue < 6){
						this.renderFlags(vt.noteValue, stemXpx, stemYspanPx, stemYendPx - stemYspanPx);
					}
				}
			}
		}
	}

	// Drawing beams and corresponding stems:
	var voice, beamGroup, beam, beamAngle = 0; // beamAngle: -2 = descending, +2 ascending
	for(var v = 0;  v < this.voiceBeamGroups.length; v++){

		for(var bg = 0; bg < this.voiceBeamGroups[v].length; bg++){
			beamGroup = this.voiceBeamGroups[v][bg];
			var upperLeftXPx, upperLeftYPx, upperRightXPx, upperRightYPx;

			for(var b = 0; b < beamGroup.beams.length; b++){
				beam = beamGroup.beams[b];
				//Her: IF 8d beam, hvis ikke gjør en enkel tegnerutine.
				if(beam.beamValue == 5){

					beam.calcPositions();
					// Setting stemDir:
					// Checking if first note in beam has forced stemDir:
					if(beamGroup.voiceTicks[beam.fromNoteIndex].forcedStemDir != 0){
						stemDir = beamGroup.voiceTicks[beam.fromNoteIndex].forcedStemDir;
					}
					else{
						if(this.noOfVoices > 1){
							// More than one voice, stemDir set by voiceNr
							if(v % 2 != 0){ stemDir = 1; } else{ stemDir = -1;  }
						}
						else{
							if(beam.avgYpos >= HIGHEST_UPSTEM_YPOS){ stemDir = -1; }
							else{ stemDir = 1; }
						}
					}
					// Beam vinkel: settes ved avstand start, slutt.
					// 0 = flat. 0.5 - 1 = liten vinkel. > 1 = stor vinkel
					//
					// Beam avstand: 8del beam settes av minste underdeling i beam og
					// ekstremnote. Prøve først: Se bort fra sub-beams.
					var firstNoteInfo, lastNoteInfo, extremeNoteInfo;
					var rotationPointXposPx, rotationPointYposPx;
					var midNoteLineYPx;

					// setting beamAngle:
					beamAngle = 0;
					if(beam.weightedAscend < -4){ beamAngle = -2; }
					else if(beam.weightedAscend < -2){ beamAngle = -1;  }
					else if(beam.weightedAscend > 4){ beamAngle = 2; }
					else if(beam.weightedAscend > 2){ beamAngle = 1; }

					if(stemDir < 0){
						firstNoteInfo = itemImagesInfo[beam.leftBot.imgNr];
						lastNoteInfo = itemImagesInfo[beam.rightBot.imgNr];
						extremeNoteInfo =itemImagesInfo[beam.highestOnTop.imgNr];
						rotationPointXposPx = beam.highestOnTop.XposPx + extremeNoteInfo.param2 * spacingPx;
						rotationPointYposPx = beam.highestOnTop.YposPx - 3 * spacingPx;
						upperLeftXPx = beam.leftBot.XposPx;
						upperRightXPx = beam.rightBot.XposPx;
						upperLeftXPx += firstNoteInfo.param2 * spacingPx;
						upperRightXPx += lastNoteInfo.param2 * spacingPx;

					}
					else{
						firstNoteInfo = itemImagesInfo[beam.leftTop.imgNr];
						lastNoteInfo = itemImagesInfo[beam.rightTop.imgNr];
						extremeNoteInfo =itemImagesInfo[beam.lowestOnBot.imgNr];
						rotationPointXposPx = beam.lowestOnBot.XposPx + extremeNoteInfo.param1 * spacingPx;
						rotationPointYposPx = beam.lowestOnBot.YposPx +  4 * spacingPx - BEAM_THICKNESS * spacingPx;
						upperLeftXPx = beam.leftTop.XposPx;
						upperRightXPx = beam.rightTop.XposPx;
						upperLeftXPx += firstNoteInfo.param1 * spacingPx;
						upperRightXPx += lastNoteInfo.param1 * spacingPx;

					}

					// Up AND Down stem beams:
					beam.XYcoeff = (beamAngle * spacingPx / 1.5) / (upperRightXPx - upperLeftXPx);
					upperLeftYPx = rotationPointYposPx - ((rotationPointXposPx - upperLeftXPx) * beam.XYcoeff);
					upperRightYPx = rotationPointYposPx + ((upperRightXPx - rotationPointXposPx) * beam.XYcoeff);
					midNoteLineYPx = beam.leftTop.YposPx - beam.leftTop.Ypos * spacingPx + 2.0 * spacingPx;

					// Adjusting beam to midstaff if high/low notes:
					if((((upperLeftYPx + upperRightYPx) / 2) - midNoteLineYPx) * -stemDir > 0 ){
						var offsetYPx = ((upperLeftYPx + upperRightYPx) / 2 - midNoteLineYPx) * stemDir;
						upperLeftYPx -= offsetYPx * stemDir;
						upperRightYPx -= offsetYPx * stemDir;
						rotationPointYposPx -= offsetYPx * stemDir;
					}

					//Making room for 16th or smaller value beams:
					if(beam.valueShortestNote < 5){
						var offsetYPx = BEAM_THICKNESS * 2 * spacingPx * stemDir * (5 - beam.valueShortestNote);
						upperLeftYPx += offsetYPx;
						upperRightYPx += offsetYPx;
						rotationPointYposPx += offsetYPx;
					}

					//Stems
					var rootNote, rootInfo, stemXpx, stemYstartPx;
					for(var vtIx = beam.fromNoteIndex; vtIx <= beam.toNoteIndex; vtIx++){
						if(stemDir == -1){
							rootNote = beamGroup.voiceTicks[vtIx].noteRests[0];
							rootInfo = itemImagesInfo[rootNote.imgNr];
							stemXpx = rootNote.XposPx + rootInfo.param2 * spacingPx;
							stemYstartPx = rootNote.YposPx + rootInfo.param4 * spacingPx;
						}
						else{
							rootNote = beamGroup.voiceTicks[vtIx].noteRests[beamGroup.voiceTicks[vtIx].noteRests.length - 1];
							rootInfo = itemImagesInfo[rootNote.imgNr];
							stemXpx = rootNote.XposPx;
							stemYstartPx = rootNote.YposPx + rootInfo.param3 * spacingPx;
						}
						stemYendPx = rotationPointYposPx + ((stemXpx - rotationPointXposPx) * beam.XYcoeff);
						context.lineWidth = stemW;
						context.beginPath();
						context.moveTo(stemXpx, stemYstartPx);
						context.lineTo(stemXpx, stemYendPx);
						context.stroke();
					}
					beam.rotationPointXposPx = rotationPointXposPx;
					beam.rotationPointYposPx = rotationPointYposPx;
					beam.stemDir = stemDir;


				}// if 8note beam
				else{

					//alert(beam.fromNoteIndex + " -> " + beam.toNoteIndex);
					var leftVt = beamGroup.voiceTicks[beam.fromNoteIndex];
					var rightVt = beamGroup.voiceTicks[beam.toNoteIndex];
					var leftRoot, rightRoot;
					if(beam.mainBeam.stemDir == -1){
						leftRoot = leftVt.noteRests[0];
						rightRoot = rightVt.noteRests[0];
						var leftInfo = itemImagesInfo[leftRoot.imgNr];
						var rightInfo = itemImagesInfo[rightRoot.imgNr];
						upperLeftXPx = leftRoot.XposPx + leftInfo.param2 * spacingPx;
						upperRightXPx = rightRoot.XposPx + rightInfo.param2 * spacingPx;
					}
					else{
						leftRoot = leftVt.noteRests[leftVt.noteRests.length - 1];
						rightRoot = rightVt.noteRests[rightVt.noteRests.length - 1];
						var leftInfo = itemImagesInfo[leftRoot.imgNr];
						var rightInfo = itemImagesInfo[rightRoot.imgNr];
						upperLeftXPx = leftRoot.XposPx + leftInfo.param1 * spacingPx;
						upperRightXPx = rightRoot.XposPx + rightInfo.param1 * spacingPx;
					}
					if(beam.isFlag){
						if(beam.flagDirIsLeft){ upperLeftXPx = upperRightXPx - spacingPx; }
						else{ upperRightXPx = upperLeftXPx + spacingPx; }
					}


					upperLeftYPx = (upperLeftXPx - beam.mainBeam.rotationPointXposPx) * beam.mainBeam.XYcoeff +
								   beam.mainBeam.rotationPointYposPx;
					upperRightYPx = (upperRightXPx - beam.mainBeam.rotationPointXposPx) * beam.mainBeam.XYcoeff +
								   beam.mainBeam.rotationPointYposPx;

					// Calculating x posisiton of sub beam:
					upperLeftYPx -= BEAM_THICKNESS * spacingPx * 2 * stemDir *  (5 - beam.beamValue);
					upperRightYPx -= BEAM_THICKNESS * spacingPx * 2 * stemDir * (5 - beam.beamValue);

				}
				context.beginPath();
				context.moveTo(upperLeftXPx, upperLeftYPx);
				context.lineTo(upperRightXPx, upperRightYPx);
				context.lineTo(upperRightXPx, upperRightYPx + spacingPx * BEAM_THICKNESS);
				context.lineTo(upperLeftXPx, upperLeftYPx + spacingPx * BEAM_THICKNESS);
				context.lineTo(upperLeftXPx, upperLeftYPx);
				context.fill();
				context.stroke();



			}// for beam
		}
	}
};

Staff_Measure.prototype.renderFlags = function(noteValue, stemRootXPx, stemRootYPx, stemLengthPx){
	// Settings:
	var EIGHT_FLAG_WIDTH = spacingPx;
	var SUB_FLAG_WIDTH = spacingPx * 0.75;

	// Calculating how many flags:
	// FORENKLE MED LOG2!!!
	var noOfFlags = 6 - noteValue;
	if(noOfFlags < 0){ noOfFlags = 0; }

	var direction = 1;
	if( stemLengthPx < 0 ){ direction = -1; };
	var flagOuterRootXPx = stemRootXPx, flagOuterRootYPx, flagTipXPx, flagTipYPx;
	var outerConcaveXPx, outerConcaveYPx, outerConvexXPx,outerConvexYPx;
	var innerConcaveXPx, innerConcaveYPx;
	if(noOfFlags == 1){
		// Rendering of 8th note flag:
		flagOuterRootYPx = stemRootYPx + stemLengthPx;
		flagTipXPx = stemRootXPx + spacingPx * 0.8;
		flagTipYPx = flagOuterRootYPx -  (spacingPx * 3.2 * direction);
		outerConcaveXPx = flagOuterRootXPx + spacingPx * 1.6;
		outerConcaveYPx = flagOuterRootYPx - (spacingPx * 1.0 * direction);
		outerConvexXPx = stemRootXPx + spacingPx * 0.1;
		outerConvexYPx = flagOuterRootYPx - (spacingPx * 1 * direction);
		innerConcaveXPx = stemRootXPx + spacingPx * 1.5;
		innerConcaveYPx = flagOuterRootYPx - (spacingPx * 0.9 * direction);

		context.beginPath();
		context.moveTo(flagOuterRootXPx, flagOuterRootYPx);
		context.bezierCurveTo(outerConvexXPx, outerConvexYPx,
							  outerConcaveXPx, outerConcaveYPx,
							  flagTipXPx, flagTipYPx);
		context.bezierCurveTo(flagTipXPx, flagTipYPx,
							  innerConcaveXPx, innerConcaveYPx,
							  flagOuterRootXPx, flagOuterRootYPx - EIGHT_FLAG_WIDTH * direction);
		context.fill();
		context.stroke();
	}
	else{
		// Rendering the innermost of multiple flags:
		flagOuterRootYPx = stemRootYPx + stemLengthPx - spacingPx * 0.5 * direction;
		flagTipXPx = stemRootXPx + spacingPx * 0.8;
		flagTipYPx = flagOuterRootYPx -  (spacingPx * 2.7 * direction);
		outerConcaveXPx = flagOuterRootXPx + spacingPx * 1.4;
		outerConcaveYPx = flagOuterRootYPx - (spacingPx * 1.0 * direction);
		outerConvexXPx = stemRootXPx + spacingPx * 0.3;
		outerConvexYPx = flagOuterRootYPx - (spacingPx * 0.8 * direction);
		innerConcaveXPx = stemRootXPx + spacingPx * 1.4;
		innerConcaveYPx = flagOuterRootYPx - (spacingPx * 1.0 * direction);

		context.beginPath();
		context.moveTo(flagOuterRootXPx, flagOuterRootYPx);
		context.bezierCurveTo(outerConvexXPx, outerConvexYPx,
							  outerConcaveXPx, outerConcaveYPx,
							  flagTipXPx, flagTipYPx);
		context.bezierCurveTo(flagTipXPx, flagTipYPx,
							  innerConcaveXPx, innerConcaveYPx,
							  flagOuterRootXPx, flagOuterRootYPx - (SUB_FLAG_WIDTH * direction));
		context.fill();
		context.stroke();
		for(var flagNr = 2; flagNr <= noOfFlags; flagNr++){
			flagOuterRootYPx = flagOuterRootYPx + (SUB_FLAG_WIDTH * direction);
			flagTipXPx = stemRootXPx + spacingPx * 0.9;
			flagTipYPx = flagOuterRootYPx -  (spacingPx * 2.0 * direction);
			outerConcaveXPx = flagOuterRootXPx + spacingPx * 1.4;
			outerConcaveYPx = flagOuterRootYPx - (spacingPx * 1.0 * direction);
			outerConvexXPx = stemRootXPx + spacingPx * 0.3;
			outerConvexYPx = flagOuterRootYPx - (spacingPx * 0.8 * direction);
			innerConcaveXPx = stemRootXPx + spacingPx * 1.4;
			innerConcaveYPx = flagOuterRootYPx - (spacingPx * 1.0 * direction);

			context.beginPath();
			context.moveTo(flagOuterRootXPx, flagOuterRootYPx);
			context.bezierCurveTo(outerConvexXPx, outerConvexYPx,
								  outerConcaveXPx, outerConcaveYPx,
								  flagTipXPx, flagTipYPx);
			context.bezierCurveTo(flagTipXPx, flagTipYPx,
								  innerConcaveXPx, innerConcaveYPx,
								  flagOuterRootXPx, flagOuterRootYPx - (SUB_FLAG_WIDTH * direction));
			context.lineTo(stemRootXPx, flagOuterRootYPx);
			context.fill();
			context.stroke();


		}


		// Loop gjennom alle flagg i tillegg til det innerste

	}
};

Staff_Measure.prototype.renderRest = function(noteValue, dots, posXPx, posYPx, innerLeftXPx, innerWidthPx){
	if(noteValue == 99){
		context.fillRect(innerLeftXPx + innerWidthPx/2 - spacingPx / 2, posYPx + 0.5 * spacingPx, spacingPx, spacingPx / 2);
	}
	else if(noteValue == 8){
		context.fillRect(posXPx, posYPx + 0.5 * spacingPx, spacingPx, spacingPx / 2);
	}
	else if(noteValue == 7){
		context.fillRect(posXPx, posYPx, spacingPx, spacingPx / 2);
		context.stroke();
	}
	else if(noteValue == 6){
		renderImage(4, posXPx, posYPx);
	}
	else{
		// 8th note rest or smaller:
		//alert("small rest detected)";

		//Calculating the number of ellipses to be drawn:
		posYPx -= spacingPx * 0.5;
		var nrOfEllipses = 6 - noteValue;
		//alert(nrOfEllipses);
		if(Math.floor(posYPx) == posYPx){ posYPx -= 0.5 * spacingPx; }
		var ellipseXPx = posXPx;
		var ellipseYPx = posYPx;
		var stemTiltFactor = 3; // The rising factorial of the stem
		var stemRootTiltFactorLeft = stemTiltFactor - 0.5;
		var stemLengthYAxisPx = nrOfEllipses * spacingPx;
		var stemWidthXPx = spacingPx * 0.07;
		var stemRootLengthYAxisPx = spacingPx * 0.70;
		var stemTopLeftXPx = posXPx + spacingPx * 0.7;
		var stemTopLeftYPx = posYPx - spacingPx * 0.2;
		var stemBotLeftXPx = stemTopLeftXPx - stemLengthYAxisPx /stemTiltFactor;
		var stemBotLeftYPx = stemTopLeftYPx + stemLengthYAxisPx;
		var stemTopRightXPx = stemTopLeftXPx + stemWidthXPx;
		var stemTopRightYPx = stemTopLeftYPx + stemWidthXPx / stemTiltFactor;


		// Drawing the stem:
		context.beginPath();
		context.moveTo(stemTopLeftXPx, stemTopLeftYPx);
		context.lineTo(stemBotLeftXPx, stemBotLeftYPx);
		context.lineTo(stemBotLeftXPx + stemWidthXPx, stemBotLeftYPx);
		context.lineTo(stemTopRightXPx, stemTopRightYPx);
		context.lineTo(stemTopLeftXPx, stemTopLeftYPx);
		context.fill();
		context.stroke();

		// Drawing the stem root:
		context.moveTo(stemBotLeftXPx, stemBotLeftYPx);
		context.lineTo(stemBotLeftXPx - stemRootLengthYAxisPx * (1 / stemRootTiltFactorLeft),
					   stemBotLeftYPx + stemRootLengthYAxisPx);
		context.lineTo(stemBotLeftXPx - spacingPx * 0.12,
					   stemBotLeftYPx + stemRootLengthYAxisPx);
		context.lineTo(stemBotLeftXPx + stemWidthXPx, stemBotLeftYPx);
		context.fill();
		context.stroke();



		var ellipseBranchUpperXPx = stemTopLeftXPx;
		var ellipseBranchUpperYPx = stemTopLeftYPx;
		for(var ellipseIx = 0; ellipseIx < nrOfEllipses; ellipseIx++){
			context.beginPath()
			context.ellipse(ellipseXPx, ellipseYPx, spacingPx * 0.26, spacingPx * 0.28, Math.PI * 0.10, 0, 2 * Math.PI);
			context.fill();
			context.stroke();

					// Drawing the connection between ellipse and stem:
			context.moveTo(ellipseXPx + spacingPx * 0.26, ellipseYPx + spacingPx * 0.1);
			context.bezierCurveTo(ellipseXPx + spacingPx * 0.26, ellipseYPx + spacingPx * 0.1,
								  ellipseXPx + spacingPx * 0.5, ellipseYPx + spacingPx * 0.16,
								  ellipseBranchUpperXPx, ellipseBranchUpperYPx);

			context.lineTo(ellipseBranchUpperXPx - spacingPx * 0.2  * (1 / stemTiltFactor) , ellipseBranchUpperYPx + spacingPx * 0.2);
			context.bezierCurveTo(ellipseBranchUpperXPx - spacingPx * 0.2  * (1 / stemTiltFactor) , ellipseBranchUpperYPx + spacingPx * 0.2,
								  ellipseXPx + spacingPx * 0.4, ellipseYPx + spacingPx * 0.3,
								  ellipseXPx, ellipseYPx + spacingPx * 0.28);

			//context.lineTo(stemTopLeftXPx, stemTopLeftYPx);
			context.fill();
			context.stroke();

			//context.lineTo(stemTopL
			ellipseBranchUpperXPx -= spacingPx * (1 / stemTiltFactor);;
			ellipseBranchUpperYPx += spacingPx;
			ellipseXPx -= spacingPx * (1/stemTiltFactor);
			ellipseYPx += spacingPx;
		}
	}
};

var ItemImgInfo = function(scale, whFactor, xBias, yBias){
	this.scale = scale;
	// Width based on height:
	this.whFactor = whFactor;
	this.xBias = xBias;
	this.yBias = yBias;
	this.width =  scale * whFactor;
	this.isLoaded = false;
	this.param1 = 0;
	this.param2 = 0;
	this.param3 = 0;
	this.param4 = 0;
};

var GraphicItem = function(imgNr, posRef, leftX, upperY){
	// Represents a graphic item in a measure.
	// posRef = 0: Items x position folllows the notes.
	// posRef = 1. follows the left barline. 2= right barline.
	// Note placement is 0 at the left and 100 at the right.
	this.imgNr = imgNr;
	this.posRef = posRef;
	this.leftX = leftX;
	this.upperY = upperY;
	this.type = "image";
};

var GraphicTimeSignature = function(topNr, botNr, posRef, leftX, upperY){
	this.topNr = topNr;
	this.botNr = botNr;
	this.posRef = posRef;
	this.leftX = leftX;
	this.upperY = upperY;
	this.type = "time signature";
};

var TimeSignature = function(topNr, botNr, qNotePos, ticksPos){
	this.topNr = topNr;
	this.botNr = botNr;
	this.qNotePos = qNotePos;
	this.ticksPos = ticksPos;
	this.beamGroups = []; //An array of the tick length of the separate beamGroups
};

var Key = function(keyNr, qNotePos, ticksPos){
	this.keyNr = keyNr;
	this.qNotePos = qNotePos;
	this.ticksPos = ticksPos;
};

var Clef = function(clefNr, qNoteNr, ticksPos){
	this.clefNr = clefNr;
	this.qNoteNr = qNoteNr;
	this.ticksPos = ticksPos;
};


var NoteRest = function(isNote, noteNr){
	this.isNote = isNote;
	this.noteNr = noteNr; // Middle c = 60 ( midi standard)
	this.blwabv = 0; // -1=if not in scale, note below with sharp/nat. 1: above 0:no opinioni.
	this.forceAcc = false;
	this.shownAcc = 99;
	this.Xpos;
	this.Ypos;
	this.XposCode; // 0 = normal placement, 1 = alternative placement. 2 = 2nd alt placem etc.
	this.XposPx;
	this.YposPx;
	this.imgNr;
	this.forcedStemDir = 0;
	this.stemLength = 0;
	this.stemXoffset;
	this.stemYoffset;
	this.type = "noteRest";
};

/*
var PureNoteRest = function(noteNrArray, qNoteLength, ticksLength){
		this.noteNrArray = noteNrArray;
		this.qNoteLength = qNoteLength;
		this.ticksLength = ticksLength;
};
*/



// Function to tell if a noteNr is a natural:
var noteIsInCScale = function(noteNr){
	var scaleStep = noteNr % 12;
	if(scaleStep == 1 || scaleStep == 3 || scaleStep == 6 || scaleStep == 8 || scaleStep == 10){
		return false;
	}
	else { return true; }
};

// Object to store scalesteps resulting from temporary accidentals.
var CScaleVersion = new function(ticksPos){
	//this.steps = stepsArray;
	this.ticksPos = ticksPos;
};

/*
CScaleVersion.prototype.buildScale = function(prevScale, stepWithAcc, acc){
	this.steps = prevScale.steps;
	var cScale = [0, 2, 4, 5, 7, 9, 11];
	this.steps[stepWithAcc] = cScaleStep + acc;

};
*/

// Accidental object stored by staff measure to keep track of temp accidentals
var TmpAcc = function(ticksPos, cScaleStep, accValue){
	this.ticksPos = ticksPos;
	this.cScaleStep = cScaleStep;
	this.accValue = accValue;
}

//  All music items at one particular tick is stored in a StaffTick.
// The StaffTick objects are stored in order in the staff_measure staffTicks array
var StaffTick = function(ticksPos){
	this.ticksPos = ticksPos;
	this.width; // the width needed by the items on this tick in this staff
	this.voiceTicks = []; //Contains voiceTicks which contains noteRests-
}

StaffTick.prototype.addNoteRest = function(noteRest, noteValue, dots, voiceNr){
	if(this.voiceTicks[voiceNr] == undefined){
		var vt = new VoiceTick(this, noteValue, dots)
		this.voiceTicks[voiceNr] = vt;
	}
	this.voiceTicks[voiceNr].addNoteRest(noteRest);
};

StaffTick.prototype.removeNoteRest = function(noteRest, voiceNr){
	this.voiceTicks[voiceNr].removeNoteRest();
	if(this.voiceTicks[voiceNr].noteRests.length == 0){
		this.voiceTicks[voiceNr] = undefined;
	}
};





// VoiceTick objects contains the noteRests of one voice at one tick position.
// It is responsible for stem, beams/flag and articulation.
VoiceTick = function(staffTick, noteValue, dots){
	this.staffTick = staffTick;
	this.noteValue = noteValue; // 2 = whole Note, 3 = half, 4 = quarter (Dorico)
	this.dots = dots; // no of dots
	this.noteRests = [];
	this.isBeamed = false;
	this.width;
	this.avgYpos; // The average Ypos value of all the notes. Set by buildGraphic.
	this.forcedStemDir = 0; // -1 = upStem, 1 = downStem
};


VoiceTick.prototype.addNoteRest = function(noteRest){
	// adding the noteRest while maintaining the lowest to highest note order:
	if(this.noteRests.length == 0 || this.noteRests[this.noteRests.length - 1].noteNr <= noteRest.noteNr){
		this.noteRests.push(noteRest);
	}
	else{
		for(var i = 0; i < this.noteRests.length; i++){
			if(this.noteRests[i].noteNr >= noteRest.noteNr){
				this.noteRests.splice(i, 0, noteRest);
				break;
			}
		}
	}
};

VoiceTick.prototype.removeNoteRest = function(noteRest){
	for(var i = 0; i < this.noteRests.length; i++){
		if(this.noteRests[i] == noteRest){
			this.noteRests.splice(i, 1);
			break;
		}
	}
};

VoiceTick.prototype.calcAverageYpos = function(){
	this.avgYpos = (this.noteRests[0].Ypos + this.noteRests[this.noteRests.length - 1].Ypos)/2;
};

// the beamgroup is a collection of beams for one beam region. The objects are created by Staff_Measure.buildGraphic
var BeamGroup = function(fromTick, toTick){ //toTick is EXCLUSIVE
	this.fromTick = fromTick;
	this.toTick = toTick;
	this.voiceTicks = []; //An ordered array with all noteRests in the group.
	this.beams =[]; // Stores the beams
};

BeamGroup.prototype.buildBeams = function(){

	// Må utvides til å fange opp sub beams også
	//
	var firstVoiceTickIx, lastVoiceTickIx, vtAtIx, ticksShortestNote;
	var readyForNew = true;
	//alert(this.voiceTicks.length);
	for(var i = 0; i < this.voiceTicks.length; i++){
		vtAtIx = this.voiceTicks[i];
		//alert("Noteverdi vt: " + vtAtIx.noteValue);
		if(readyForNew && vtAtIx.noteValue < 6){
			firstVoiceTickIx = i;
			valueShortestNote = vtAtIx.noteValue;
			readyForNew = false;
			//alert("Starter ny beam bygging");
		}
		else if(!readyForNew && vtAtIx.noteValue < 6 && vtAtIx.noteRests[0].isNote){
			lastVoiceTickIx = i;
			if(vtAtIx.noteValue < valueShortestNote){ valueShortestNote = vtAtIx.noteValue; }
			//alert("beambygg, lastNoteIx: " + lastVoiceTickIx);
		}
		if(vtAtIx.noteValue >= 6 || i == this.voiceTicks.length - 1 || !vtAtIx.noteRests[0].isNote){
			//alert("nesten der, første, siste: " + firstVoiceTickIx + ", " + lastVoiceTickIx);
			if(!readyForNew && lastVoiceTickIx > firstVoiceTickIx){
				// We have a beam!
				//alert("We have a beam, firstIx: " + firstVoiceTickIx + " last Ix: " + lastVoiceTickIx);
				var bm = new Beam(this, 5, firstVoiceTickIx, lastVoiceTickIx);
				for(var vtIx = firstVoiceTickIx; vtIx <= lastVoiceTickIx; vtIx++){
					this.voiceTicks[vtIx].isBeamed = true;
				}
				this.beams.push(bm);

				// Creating sub beams:
				var subBeamFirstVoiceTickIx, subBeamLastVoiceTickIx;
				for(var beamValue = 4; beamValue >= valueShortestNote; beamValue -= 1){
					readyForNew = true;
					for(var i2 = bm.fromNoteIndex; i2 <= bm.toNoteIndex; i2++){

						vtAtIx = this.voiceTicks[i2];
						if(readyForNew && vtAtIx.noteValue <= beamValue){
							subBeamFirstVoiceTickIx = i2;
							subBeamLastVoiceTickIx = i2;
							readyForNew = false;
						}
						else if(!readyForNew && vtAtIx.noteValue <= beamValue){
							subBeamLastVoiceTickIx = i2;
						}
						if(vtAtIx.noteValue > beamValue || i2 == bm.toNoteIndex){
							if(!readyForNew){
								var subBm = new Beam(this, beamValue, subBeamFirstVoiceTickIx, subBeamLastVoiceTickIx);
								subBm.mainBeam = bm;
								if(subBm.fromNoteIndex == subBm.toNoteIndex){
									// Is a "flag" type beam:
									subBm.isFlag = true;
									if(subBm.fromNoteIndex == subBm.mainBeam.fromNoteIndex){
										subBm.flagDirIsLeft = false;
									}
									else if(subBm.fromNoteIndex == subBm.mainBeam.toNoteIndex){
										subBm.flagDirIsLeft = true;
									}
									else{
										// Flagged note is NOT first or last in main beam
										// Direction depends on "slot nr" in beamgroup, odd or even:
										var ticksPos = this.voiceTicks[subBm.fromNoteIndex].staffTick.ticksPos - this.fromTick;
										var subBmTicksValue = Q_NOTE * Math.pow(2, subBm.beamValue - 6);
										var vtSubDivSlotNr = Math.round(ticksPos / subBmTicksValue);
										if(vtSubDivSlotNr % 2 == 0){ subBm.flagDirIsLeft = false; }
										else{ subBm.flagDirIsLeft = true; }
									}
								}
								this.beams.push(subBm);
								readyForNew = true;
							}
						}

					}
				}
			}
			readyForNew = true;
		}

	}

};

var Beam = function(beamGroup, beamValue, fromNoteIndex, toNoteIndex){
	this.beamGroup = beamGroup;
	this.beamValue = beamValue;
	this.fromNoteIndex = fromNoteIndex;
	this.toNoteIndex = toNoteIndex;
	//this.voiceTicks = [];
	this.mainBeam;
	this.avgYpos;
	this.leftTop;
	this.leftBot;
	this.rightTop;
	this.rightBot;
	this.highestOnTop;
	this.lowestOnBot;
	this.totalAscend;
	this.totalDescend;
	this.weightedAscend; // start end: weight 1, next: w=0.5 etc.
	this.isFlag = false;
	this.flagDirIsLeft = false;
	this.stemDir;
	this.startXpos;
	this.startYpos;
	this.endXpos;
	this.endYpos;
	//this.upperLeftXPx;
	//this.upperLeftYPx;
	//this.upperRightXPx;
	//this.upperRightYPx;
	this.rotationPointXposPx;
	this.rotationPointYposPx;
	this.XYcoeff;
	this.valueShortestNote;
};


// this method is only needed for main beam (8th note beam)
Beam.prototype.calcPositions = function(){
	this.avgYpos = 0;
	this.totalAscend = 0;
	this.totalDescend = 0;
	this.weightedAscend = 0;

	var voiceTick, ascWeight;
	var halfWay = (this.toNoteIndex - this.fromNoteIndex) / 2;
	var halfCounter = halfWay;
	this.valueShortestNote = 9999;
	for(var i = this.fromNoteIndex; i <= this.toNoteIndex; i++){
		voiceTick = this.beamGroup.voiceTicks[i];
		this.avgYpos += voiceTick.avgYpos;
		if(i == this.fromNoteIndex){
			this.leftTop = voiceTick.noteRests[voiceTick.noteRests.length - 1];
			this.leftBot = voiceTick.noteRests[0];
		}
		else if(i == this.toNoteIndex){
			this.rightTop = voiceTick.noteRests[voiceTick.noteRests.length - 1];
			this.rightBot = voiceTick.noteRests[0];
		}
		if(this.highestOnTop == undefined || voiceTick.noteRests[voiceTick.noteRests.length - 1].Ypos < this.highestOnTop.Ypos){
			this.highestOnTop = voiceTick.noteRests[voiceTick.noteRests.length - 1];
		}
		if(this.lowestOnBot == undefined || voiceTick.noteRests[0].Ypos > this.lowestOnBot.Ypos){
			this.lowestOnBot = voiceTick.noteRests[0];
		}
		if(i > this.fromNoteIndex){
			var diff = voiceTick.avgYpos - this.beamGroup.voiceTicks[i-1].avgYpos;
			if(diff > 0){ this.totalDescend += diff; }
			else{ this.totalAscend -= diff;  }
		}
			this.weightedAscend -= halfCounter * voiceTick.avgYpos / halfWay;
			halfCounter -= 1;

			if(voiceTick.noteValue < this.valueShortestNote){ this.valueShortestNote = voiceTick.noteValue; }

	}
	this.weightedAscend += (this.beamGroup.voiceTicks[this.toNoteIndex].avgYpos
						   - this.beamGroup.voiceTicks[0].avgYpos) * 0.5;
	this.avgYpos /= (this.toNoteIndex - this.fromNoteIndex);

	if(this.fromNoteIndex == this.toNoteIndex){ this.isFlag = true; }
};

// GLOBAL HELPER FUNCTIONS:

// Tries to match the given ticks to a corresponding note value including dots.
// If impossible: Returns the remainding ticks.
// Returns a dictionary with noteValue: dots:  and ticksRemaining:
var noteValueFromTicks = function(ticksLength){
	var noteValue = Math.floor(Math.log2(ticksLength/Q_NOTE) + 6);
	var remainder = ticksLength - this.ticksFromNoteValueDots(noteValue, 0);
	//console.log("NOTE FROM TICKS: Remaining before dot:" + remainder + " remainder/noteTicsk=" + remainder / this.ticksFromNoteValueDots(noteValue, 0) );
	var dots = 0;
	if(remainder >= ticksLength / 4 && remainder < ticksLength){
		var dots = -1 * Math.ceil(Math.log2(1 - (remainder / this.ticksFromNoteValueDots(noteValue, 0))));
		//console.log("NOTE FROM TICKS: dots calc: remaining: " + remainder + " / ticksFrom NoteV: " + this.ticksFromNoteValueDots(noteValue, 0));
	}
	if( dots > MAX_DOTS){ dots = MAX_DOTS; }

	if( dots > 0){ remainder -= ticksFromNoteValueDots(noteValue - 1, dots -1); }
	//console.log("NOTE FROM TICKS: noteV from Tx:  = " + "  noteValue: " + noteValue + "  dots: " + dots + "  r: " + remainder);
	//console.log("NOTE FROM TICKS: ticks from noteValue and dots = " + ticksFromNoteValueDots(noteValue, dots));
	return { "noteValue": noteValue, "dots": dots, "remainder": remainder };
};

var ticksFromNoteValueDots = function(noteValue, dots){
	var ticks = Q_NOTE / Math.pow(2, 6 - noteValue);
	ticks += ticks * (1 - Math.pow(2, 0 - dots));
	return ticks;
};


// UNDO:

// Undoing the last event:
var undo = function(){
	histEvent = historyStack.pop();
	if(histEvent.action == "addNoteRest"){
		console.log("Skal til å fjerne noteRest");
		// Removes last added noteRest and sets cursor to the note position:
		/*
		var prevInputNoteNr = inputNoteNr;
		inputNoteNr = inputOctaveOffset + noteNamesToNr[event.key];
		if(inputNoteNr - prevInputNoteNr < -6){
			inputNoteNr += 12;
			inputOctaveOffset += 12;
		}
		else if(inputNoteNr - prevInputNoteNr > 6){
			inputNoteNr -= 12;
			inputOctaveOffset -= 12;
		}
		*/

		/*
		score.removeNoteRest(histEvent.object, histEvent.ticksPos, histEvent.measNr, histEvent.voiceNr);
		score.updateMeasures(0, Q_NOTE * 100);
		score.buildGraphic();

		inputCurrentTicksPos += Q_NOTE / Math.pow(2, 6 - inputNoteValue);
		if(inputCurrentTicksPos >= Q_NOTE * 4){
			inputCurrentTicksPos = 0;
			inputCurrentMeasNr += 1;
		}
		render(true);
		*/
	}


};
