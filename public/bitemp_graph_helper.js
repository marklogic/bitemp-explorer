/*globals d3, jQuery, loadData, barChart */
//function to make ajax call to get min and max times
var firstDoc, lastDoc;
function ajaxTimesCall(selectedColl, search) {
  $.ajax(
  {
    url: '/v1/resources/temporal-range?rs:collection='+selectedColl,
    success: function(response, textStatus)
    {
      if (search) {
        displayAxis(response); //don't want to call this if not on search page, clears graph otherwise.
        respTimes = response;
      }
    },
    error: function(jqXHR, textStatus, errorThrown)
    {
      console.log('problem');
    }
  });
}

//function to display axis
function displayAxis(times) {
  var showAlertBox = false;
  if( !times.valStart ) {
    showAlertBox = true;
  }

  var timeRanges = {
    valStart: toReturnDate(times.valStart),
    valEnd: toReturnDate(times.valEnd),
    sysStart: toReturnDate(times.sysStart),
    sysEnd: toReturnDate(times.sysEnd)
  }

  getBarChart({
    data: [],
    width: 800,
    height: 600,
    xAxisLabel: 'System',
    yAxisLabel: 'Valid',
    timeRanges: timeRanges,
    containerId: 'bar-chart-large'
  }, null);

  if (showAlertBox) {
    alert('There are no documents in this collection. Please select another.');
  }
}

var getDocColl = function(uri) {
  $.ajax({
    url: '/v1/documents?uri='+uri+'&category=collections&format=json',
    success: function(data, textStatus) {
      console.log('got collections: ' + data);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log('problem');
    },
    async: false,
  });
}

function toReturnDate(time) {
  if(time) {
    return new Date(time);
  }
  else {
    return null;
  }
}

var addTempColls = function(id, search) {
  var rtnVal = $.ajax(
    {
      url: '/manage/v2/databases/Documents/temporal/collections?format=json',
      success: function(response, textStatus)
      {
        //adds names of the collections to the drop down list
        var addToDrop = $('#' + id);
        //endpoint is the number of collections
        var endpoint = parseInt(response['temporal-collection-default-list']['list-items']['list-count'].value);

        //dropArray is the array containing all the temporal Collections
        var dropArray = [];
        for (var j = 0; j < endpoint; j++)
        {
          dropArray[j] = response['temporal-collection-default-list']['list-items']['list-item'][j].nameref;
        }
        //sorts the array (alphabetically) containing the temporal collections
        dropArray.sort();

        //Clear the drop down menu before adding new elements
        var select = document.getElementById(id);
        addToDrop.empty();

        //this for loop appends the collection names to the drop down list
        for (var k = 0; k < dropArray.length; k++)
        {
          addToDrop.append($('<option>').text(dropArray[k])) ;
          if( k === 0 ) {
            ajaxTimesCall(dropArray[k], search);
          }
        }
        if (search) {
          firstDoc = 1;
          lastDoc = 10;
         // $('#next').css({'visibility': 'visible'});
         // $('#prev').css({'visibility': 'visible'});
          displayDocs(firstDoc, lastDoc);
        }
      },
      error: function(jqXHR, textStatus, errorThrown)
      {
        console.log('problem');
      }
    });
  return rtnVal;
}

var drawChart = function(params, docProp) {
  var chart;
  if( params.timeRanges ) {
    chart = barChart()
      .data(params.data)
      .width(params.width)
      .height(params.height)
      .xMin(params.timeRanges.sysStart)
      .xMax(params.timeRanges.sysEnd)
      .yMin(params.timeRanges.valStart)
      .yMax(params.timeRanges.valEnd)
      .setDisplayProperty(docProp);
  }
  else {
    chart = barChart()
      .data(params.data)
      .width(params.width)
      .height(params.height)
      .setDisplayProperty(docProp);
    
  }
  
  var selector = '#' + params.containerId;
  d3.select(selector + ' .chart').remove();
  d3.select(selector).append('div').classed('chart', true).call(chart);

  return chart;
};

function clearTextArea() {
  document.getElementById('contents').value = '';
  document.getElementById('sysStartBox').value = '';
}

function fillText(data, isEditing) {
  clearTextArea();
  var textArea = document.getElementById('contents');
  textArea.value += '{';
  var strToAdd;
  for (var property in data) {
    strToAdd = '';
    if (data.hasOwnProperty(property)) {
      if ((property === 'sysStart' || property === 'sysEnd') && isEditing) {
        data[property] = null;
      }
      if (textArea.value !== '{') { //Add a comma onto previous line, if not on the first item.
        strToAdd += ',';
      }
      strToAdd += '\n\"' + property + '\": ';
      if (data[property]) {
        strToAdd += '\"'+ data[property] + '\"';
      }
      else { // if the property has a null value then don't put quotes around it.
        strToAdd += data[property];
      }
      textArea.value += strToAdd;
    }
  }
  textArea.value += '\n}';
  textArea.readOnly = !isEditing;
}

function cancel(chart) {
  clearTextArea();
  $('#editButton').show();
  $('#viewButton').show();
  $('#deleteButton').show();
  $('#cancelButton').hide();
  $('#contents').hide();
  $('#saveButton').hide();
  chart.setEditing(false);
  chart.setViewing(false);
  chart.setDeleting(false);
  $('#sysTimeDiv').addClass('hideSysTimeBoxes');
  $('#deleteButtonsDiv').addClass('hideSysTimeBoxes');
}

function save(chart) {
  var data = document.getElementById('contents').value.replace(/\n/g, '');
  data = jQuery.parseJSON(data);

  if (document.getElementById('sysStartBox').value) {
    data.sysStart = document.getElementById('sysStartBox').value;
  }

  var success = function() {
    cancel(chart);
  };
  var fail = function(data) {
    window.alert('PUT didn\'t work: ' + data);
  };
  console.log('Saving');   //Only working on mac, bug filed with MarkLogic
  $.ajax({
    type: 'PUT',
    contentType: 'application/json',
    url: '/v1/documents/?uri=' + chart.getCurrentURI()+'&temporal-collection=myTemporal',
    processData: false,
    data: JSON.stringify(data),
    success: success,
    error: fail
  });
}

function setupTextArea(uri, isEditing) {
  $('#editButton').hide();
  $('#viewButton').hide();
  $('#deleteButton').hide();
  $('#cancelButton').show();
  $('#contents').show();

  if (isEditing) {
    $('#saveButton').show();
  }
   var successFunc = function(data) {
    fillText(data, isEditing);
  };
  $.ajax({
    url: 'http://localhost:3000/v1/documents/?uri=' + uri,
    success: successFunc,
    format: 'json'
  });

}

function view(uri) {
  if (uri) {
    setupTextArea(uri, false); //false so function knows the document is not being edited
    $('#sysTimeDiv').addClass('hideSysTimeBoxes');
  }
  else {
    window.alert('Please click a doc first');
  }
}

function edit(uri) {
  if (uri) {
    setupTextArea(uri, true); //true so function knows the document is being edited
    $('#sysTimeDiv').removeClass('hideSysTimeBoxes');
  }
  else {
    window.alert('Please click a doc first');
  }
}

//Gets all temporal collections the uri belongs to.
function getTemporalColl(uri) {
  var docColl = $.ajax({
    url: '/manage/v2/databases/Documents/temporal/collections?format=json',
    uri: uri,
    success: function(data, textStatus) {
     console.log('Success');
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log('Problem');
    },
    async: false,
  });

 return JSON.parse(docColl.responseText);
}

//Gets all collections the uri belongs to.
function getDocColls(uri) {
  var docColl = $.ajax({
    url: '/v1/documents?uri='+uri+'&category=collections&format=json',
    success: function(data, textStatus) {},
    error: function(jqXHR, textStatus, errorThrown) {
      console.log('problem');
    },
    async: false,
  });

 return JSON.parse(docColl.responseText);
}

/*
@params:
collArr is an array of strings of collection names
tempCollArr is an array of objects with 'nameref' properties
*/
function findCommonColl(collArr, tempCollArr) {
  var response;
  while (!response) {
    for (var i in collArr) {
      for (var j in tempCollArr) {
        if (collArr[i] === tempCollArr[j]['nameref']) {
          console.log('Match: ' + collArr[i]);
          response = collArr[i];
        }
      }
    }
  }
  return response;
}

var deleteDoc = function (chart) {
  var uri = chart.getLogicalURI();
  var ajax = true;
  if (!uri) {
    return;
  }
  var collArr = getDocColls(uri);
  var tempCollections = getTemporalColl(uri);
  var tempCollArr = tempCollections['temporal-collection-default-list']['list-items']['list-item'];

  var tempColl;
  if (collArr && tempCollArr) {
    collArr = collArr['collections'];
    tempColl = findCommonColl(collArr, tempCollArr);
  }

  if (tempColl) {
    $.ajax( //Gets a temporal collection
    {
      url: '/v1/resources/temporal-range?rs:collection='+tempColl,
      success: function(response, textStatus)
      {
        deleteSuccess(response, tempColl, chart);
      },
      error: function(jqXHR, textStatus, errorThrown)
      {
        console.log('problem');
        cancel(chart);
      }
    });
  }
}
function deleteSuccess(response, tempColl, chart) {
  var sysBoxDate;
  var tempDate = new Date(response.sysEnd);
  var ajax = true;
  var currDate = new Date();

  var url = '/v1/documents?uri=' + chart.getLogicalURI() + '&temporal-collection=' + tempColl;

  //Add a system time to ajax request if specified
  sysBoxDate = document.getElementById('sysStartBox').value
  if (sysBoxDate) {
    url += '&system-time='+sysBoxDate;
    console.log('temporal date: ' + tempDate + ', specified date: ' + sysBoxDate);
    if (tempDate.valueOf() > sysBoxDate.valueOf()){
      document.getElementById('deleteErrMessage').innerHTML = 'Error: System time does not go backward.'.bold() + ' Current time is ' + tempDate;
      ajax=false;
    }
  }
  else if (currDate.valueOf() < tempDate.valueOf()) {
    ajax = false;
  }

  if (ajax) {
    $.ajax({
      url: url,
      type: 'DELETE',
      success: function(data) {
        loadData(uri);
      },
      error: function(jqXHR, textStatus) {
        cancel(chart);
        window.alert('Delete didn\'t work, error code: ' + jqXHR.status);
      },
      format: 'json'
    });
  }
  else {
    cancel(chart);
    document.getElementById('deleteErrMessage').innerHTML = 'Error: System time does not go backward.'.bold() + ' Current time for temporal collection is ' + tempDate;
  }
  $('#deleteButtonsDiv').addClass('hideSysTimeBoxes');
  $('#sysTimeDiv').addClass('hideSysTimeBoxes');
}

function setupDelete(chart) {
  var uri = chart.getCurrentURI();
  document.getElementById('deleteErrMessage').innerHTML = '';
  if (!uri) { // No uri selected
    uri = 'addr.json';
  }
  else {
    var lastPeriodLoc = uri.lastIndexOf('.');
    var firstPeriodLoc = uri.indexOf('.');
    if (lastPeriodLoc !== firstPeriodLoc) { //More than one '.', indicates a big number within uri.
      uri = uri.substring(0, firstPeriodLoc) + uri.substring(lastPeriodLoc, uri.length); // Remove the big number.
    }
  }
  chart.setLogicalURI(uri);
  $('#editButton').hide();
  $('#viewButton').hide();
  $('#deleteButton').hide();
  $('#sysTimeDiv').removeClass('hideSysTimeBoxes');
  $('#deleteButtonsDiv').removeClass('hideSysTimeBoxes');
}

function changeTextInGraph(chart, params) {
  var docProp = $('input[name = documentProperty]').val();
  if (docProp === '') {
    window.alert('Please enter a document property.');
  }
  var propExists = false;

  for(var i = 0; i < params.data.length && !propExists; i++) {
    for(var prop in params.data[i].content) {
      if (params.data[i].content.hasOwnProperty(prop)) {
        if(prop === docProp || docProp.substring(0, docProp.indexOf('.')) === prop) {
          propExists = true;
        }
      }
    }
  }
  if(propExists) {
    drawChart(params, docProp);
  }
  else if (docProp !== '') {
    window.alert('Sorry. That property does not exist in any document in the collection');
  }
}

function findProperties(obj, path, properties) {
  var newPath;
  if (typeof obj === 'object') {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        newPath = path ? path + '.' + prop : prop;
        if (Array.isArray(obj[prop])) {
          // for (var item in obj[prop]) {
          //   findProperties(obj[prop][item], newPath + '[' + item + ']', properties);
          // }
        } else if (typeof obj[prop] === 'object') {
          findProperties(obj[prop], newPath, properties);
        } else {
          properties[newPath] = true;
        }
      }
    }
  }
}


function addDataToMenu(chart, params) {
  if (!params.timeRanges){
    $('#select-prop').empty();
    var propsInGraph = {};
    propsInGraph['Choose a property'] = true;

    for(var i = 0; i < params.data.length; i++) {
      findProperties(params.data[i].content, null, propsInGraph);
    }
    var select = document.getElementById('select-prop');
    if(select) {
      for(var property in propsInGraph) {
        var opt = property;
        var el = document.createElement('option');
        el.textContent = opt;
        el.value = opt;
        select.appendChild(el);
      }
    }
  }
}


var removeButtonEvents = function () {
  //Clear these buttons' previous event handlers
  $('#editButton').unbind('click');
  $('#deleteButton').unbind('click');
  $('#cancelButton').unbind('click');
  $('#viewButton').unbind('click');
  $('#saveButton').unbind('click');
  $('#change-prop').unbind('click');
  $('#select-prop').unbind('change');
};

function initButtons() {
  document.getElementById('editButton').disabled = true;
  document.getElementById('deleteButton').disabled = true;
  document.getElementById('viewButton').disabled = true;
  document.getElementById('selectedURI').innerHTML = 'Selected URI: ' + 'null'.bold();
}

var getBarChart = function (params, docProp) {
  removeButtonEvents();
  var chart = drawChart(params, docProp);

  if (params) {
    addDataToMenu(chart, params);
  }
  if(params.timeRanges === null) {
    initButtons();
    document.getElementById('uriEntered').innerHTML = "You are displaying documents in " + uri.bold() + " with property " + chart.getDisplayProperty().bold();
  }

  $('#editButton').click(function() {
    document.getElementById('deleteErrMessage').innerHTML = '';
    edit(chart.getCurrentURI());
    chart.setEditing(true);
  });

  $('#deleteButton').click(function() {
    setupDelete(chart);
    chart.setDeleting(true);
  });

  $('#cancelButton').click(function() {
    cancel(chart);
  });

  $('#viewButton').click(function() {
    document.getElementById('deleteErrMessage').innerHTML = '';
    view(chart.getCurrentURI());
    chart.setViewing(true);
  });

  $('#saveButton').click(function() {
    save(chart);
  });

  $('#change-prop').click(function() {
    changeTextInGraph(chart, params);
  });

  addTempColls('selectTempColl', false);
  $('#createDoc').click(function() {
    $('#createDocStuff').show();

    $("#dialogCreateDoc").dialog({
      autoOpen: true,
      modal: true,
      appendTo: false,
      buttons: {
        Save: function() {
          $(this).dialog('close');
        },
        Cancel: function() {
          $(this).dialog('close');
        }
      },
    });
  });

  $('#deleteOKButton').click(function() {
    document.body.style.cursor = 'wait';
    deleteDoc(chart);
    document.body.style.cursor = 'auto';
  });

  $('#deleteCancelButton').click(function() {
    cancel(chart);
  });

  $('#select-prop').change(function() {
    var selectedText = $(this).find('option:selected').text();
    getBarChart(params, selectedText);
  });
};
