/* global W */
/* global Promise */
/* global OL */
/* global I18n */
/* global unsafeWindow */
/* global GM_info */
/* global WazeWrap */

// // ==UserScript==
// @name         WME FC Layer
// @namespace    https://greasyfork.org/users/45389
// @version      2019.10.25.001
// @description  Adds a Functional Class layer for states that publish ArcGIS FC data.
// @author       MapOMatic
// @include      /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @license      GNU GPLv3
// @contributionURL https://github.com/WazeDev/Thank-The-Authors
// @require      https://greasyfork.org/scripts/39002-bluebird/code/Bluebird.js?version=255146
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @grant        GM_xmlhttpRequest
// @connect      arcgis.com
// @connect      arkansas.gov
// @connect      azdot.gov
// @connect      coloradodot.info
// @connect      delaware.gov
// @connect      dc.gov
// @connect      ga.gov
// @connect      uga.edu
// @connect      hawaii.gov
// @connect      idaho.gov
// @connect      in.gov
// @connect      iowadot.gov
// @connect      illinois.gov
// @connect      ksdot.org
// @connect      ky.gov
// @connect      la.gov
// @connect      maine.gov
// @connect      md.gov
// @connect      ma.us
// @connect      state.mi.us
// @connect      modot.org
// @connect      mt.gov
// @connect      unh.edu
// @connect      ny.gov
// @connect      ncdot.gov
// @connect      nd.gov
// @connect      oh.us
// @connect      or.us
// @connect      pa.gov
// @connect      sd.gov
// @connect      shelbycountytn.gov
// @connect      utah.gov
// @connect      vermont.gov
// @connect      wa.gov
// @connect      wv.gov
// @connect      wyoroad.info
// ==/UserScript==

/* eslint-disable */

(function () {
    'use strict';

    var _settingsStoreName = 'wme_fc_layer';
    var _alertUpdate = false;
    var _debugLevel = 0;
    var _scriptVersion = GM_info.script.version;
    var _scriptVersionChanges = [
        GM_info.script.name,
        'v' + _scriptVersion,
        '',
        'What\'s New',
        '------------------------------',
        ''  // Add important stuff here when _alertUpdate = true.
    ].join('\n');
    var _mapLayer = null;
    var _isAM = false;
    var _uid;
    var _settings = {};
    var _r;
    var _mapLayerZIndex = 334;
    var _betaIDs = [103400892];
    var _statesHash = {
        'Alabama': 'AL', 'Alaska': 'AK', 'American Samoa': 'AS', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
        'Federated States Of Micronesia': 'FM', 'Florida': 'FL', 'Georgia': 'GA', 'Guam': 'GU', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
        'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Marshall Islands': 'MH', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND',
        'Northern Mariana Islands': 'MP', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Palau': 'PW', 'Pennsylvania': 'PA', 'Puerto Rico': 'PR', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virgin Islands': 'VI', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    };

    function reverseStatesHash(stateAbbr) {
        for (var stateName in _statesHash) {
            if (_statesHash[stateName] === stateAbbr) return stateName;
        }
    }
    var _stateSettings = {
        global: {
            roadTypes: ['St', 'PS', 'PS2', 'mH', 'MH', 'Ew', 'Rmp', 'Fw'], // Ew = Expressway.  For FC's that make it uncertain if they should be MH or FW.
            getFeatureRoadType: function (feature, layer) {
                var fc = feature.attributes[layer.fcPropName];
                return this.getRoadTypeFromFC(fc, layer);
            },
            getRoadTypeFromFC: function (fc, layer) {
                for (var roadType in layer.roadTypeMap) {
                    if (layer.roadTypeMap[roadType].indexOf(fc) !== -1) {
                        return roadType;
                    }
                }
                return null;
            },
            isPermitted: function (stateAbbr) { if (_betaIDs.indexOf(_uid) !== -1) return true; var state = _stateSettings[stateAbbr]; if (state.isPermitted) { return state.isPermitted(); } else { return (_r >= 3 && _isAM) || (_r >= 4); } },
            getMapLayer: function (stateAbbr, layerID) {
                var returnValue;
                _stateSettings[stateAbbr].fcMapLayers.forEach(function (layer) {
                    if (layer.layerID === layerID) {
                        returnValue = layer;
                    }
                });
                return returnValue;
            }
        },
        AL: {
            baseUrl: 'https://services.arcgis.com/LZzQi3xDiclG6XvQ/arcgis/rest/services/HPMS_Year2017_F_System_Data/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'F_SYSTEM_V', idPropName: 'OBJECTID', outFields: ['FID', 'F_SYSTEM_V', 'State_Sys'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            isPermitted: function () { return _r >= 3; },
            information: { Source: 'ALDOT', Permission: 'Visible to R3+', Description: 'Federal and State highways set to a minimum of mH.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>7";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = parseInt(feature.attributes[layer.fcPropName]);
                if (fc > 4 && feature.attributes.State_Sys === 'YES') { fc = 4; }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        AK: {
            baseUrl: 'https://services.arcgis.com/r4A0V7UzH9fcLVvv/ArcGIS/rest/services/AKDOTPF_Route_Data/FeatureServer/',
            defaultColors: { Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 13, fcPropName: 'Functional_Class', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'Functional_Class'],
                    roadTypeMap: { Ew: [1, 2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'Alaska DOT&PF', Permission: 'Visible to R4+ or R3-AM', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>7";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        AZ: {
            baseUrl: 'https://gis.azdot.gov/gis/rest/services/AGOL/FunClass_NHS/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#ff00c5', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1] },
            fcMapLayers: [
                {
                    layerID: 8, fcPropName: 'FunctionalClass', idPropName: 'OBJECTID',
                    outFields: ['OBJECTID', 'FunctionalClass', 'RouteId'],
                    roadTypeMap: { Fw: [1, 11], Ew: [2, 3, 12], MH: [4, 14], mH: [6, 16], PS: [7, 17, 8, 18], St: [] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'ADOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                return context.layer.fcPropName + ' NOT IN (9, 19)';
            },
            getFeatureRoadType: function (feature, layer) {
                var roadID = feature.attributes.RouteId.trim().replace(/  +/g, ' ');
                var roadNum = parseInt(roadID.substring(2, 5));
                var fc = parseInt(feature.attributes[layer.fcPropName]);
                fc = (fc === 2) ? 4 : fc % 10;
                var azIH = [8, 10, 11, 17, 19, 40]; // Interstate hwys in AZ
                var isUS = RegExp(/^U\D\d{3}\b/).test(roadID);
                var isState = RegExp(/^S\D\d{3}\b/).test(roadID);
                var isBiz = RegExp(/^SB\d{3}\b/).test(roadID);
                if (fc > 4 && isState && azIH.includes(roadNum) && isBiz) {
                    fc = 4;
                } else if (fc > 4 && isUS) {
                    fc = isBiz ? 6 : 4;
                } else if (fc > 6 && isState) {
                    fc = isBiz ? 7 : 6;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        AR: {
            baseUrl: 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Transportation/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 8, fcPropName: 'FunctionalClass', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalClass', 'AH_Route', 'AH_Section'],
                    roadTypeMap: { Fw: [1, 2], Ew: [], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'ARDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                return null;
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr[layer.fcPropName]);
                var roadID = parseInt(attr.AH_Route);
                var usHwys = [49, 59, 61, 62, 63, 64, 65, 67, 70, 71, 79, 82, 165, 167, 270, 271, 278, 371, 412, 425];
                var isUS = usHwys.includes(roadID);
                var isState = roadID < 613;
                var isBiz = attr.AH_Section[attr.AH_Section.length - 1] === 'B';
                if (fc > 3 && isUS) {
                    fc = isBiz ? 4 : 3;
                } else if (fc > 4 && isState) {
                    fc = isBiz ? 5 : 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        CO: {
            baseUrl: 'http://dtdapps.coloradodot.info/arcgis/rest/services/MapView/BaseLayers_MapView_ext/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 7, fcPropName: 'FUNCCLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCCLASS', 'ROUTE', 'REFPT'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 17, fcPropName: 'FUNCCLASSID', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCCLASSID', 'ROUTE', 'FIPSCOUNTY'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 18, fcPropName: 'FUNCCLASSID', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCCLASSID', 'ROUTE'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            isPermitted: function () { return _r >= 4; },
            information: {
                Source: 'CDOT', Permission: 'Visible to R4+',
                Description: 'Please consult with a state manager before making any changes to road types based on the data presented.'
            },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>'7'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr[layer.fcPropName]);
                var route = attr.ROUTE.replace(/  +/g, ' ');
                if (layer.layerID === 7) {
                    var rtnum = parseInt(route.slice(0, 3));
                    var refpt = attr.REFPT;
                    var hwys = [6, 24, 25, 34, 36, 40, 50, 70, 84, 85, 87, 138, 160, 285, 287, 350, 385, 400, 491, 550];
                    var IH = [25, 70];
                    // Exceptions first, then normal classification
                    var doNothing = ['024D', '040G'];
                    var notNothing = ['070K', '070L', '070O', '070Q', '070R'];
                    var doMin = ['024E', '050D', '070O', '085F', '160D'];
                    if (doNothing.includes(route) || (rtnum === 70 && route !== '070K' && !notNothing.includes(route))) { }
                    else if (doMin.includes(route) ||
                        (rtnum === 40 && refpt > 320 && refpt < 385) ||
                        (rtnum === 36 && refpt > 79 && refpt < 100.99) ||
                        (route === '034D' && refpt > 11)) {
                        fc = 4;
                    } else if (hwys.includes(rtnum)) {
                        fc = Math.min(fc, 3);
                    }
                    else {
                        fc = Math.min(fc, 4);
                    }
                }
                else {
                    // All exceptions
                    var fips = parseInt(attr.FIPSCOUNTY);
                    if ((fips === 19 && route === 'COLORADO BD') ||
                        (fips === 37 && (route === 'GRAND AV' || route === 'S H6'))) { fc = 3; }
                    else if (fips === 67 && route === 'BAYFIELDPAY') { fc = 4; }
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        DE: {
            baseUrl: 'https://firstmap.delaware.gov/arcgis/rest/services/Transportation/DE_FUNCTIONAL_CLASSIFICATION/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'VALUE_TEXT', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'VALUE_TEXT'], maxRecordCount: 1000, supportsPagination: false,
                    roadTypeMap: { Fw: ['Interstate'], Ew: ['Other Expressways & Freeway'], MH: ['Other Principal Arterials'], mH: ['Minor Arterial'], PS: ['Major Collector', 'Minor Collector'], St: ['Local'] }
                }
            ],
            information: { Source: 'Delaware FirstMap', Permission: 'Visible to R4+ or R3-AM', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + " <> 'Local'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        DC: {
            baseUrl: 'https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Transportation_WebMercator/MapServer/',
            supportsPagination: false,
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fetchAllFC: false,
            fcMapLayers: [
                {
                    layerID: 48, fcPropName: 'FUNCTIONALCLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONALCLASS'], maxRecordCount: 1000, supportsPagination: false,
                    roadTypeMap: { Fw: ['Interstate'], Ew: ['Other Freeway and Expressway'], MH: ['Principal Arterial'], mH: ['Minor Arterial'], PS: ['Collector'] }
                }
            ],
            information: { Source: 'DDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                return null;
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        FL: {
            baseUrl: 'https://services1.arcgis.com/O1JpcwDW8sjYuddV/ArcGIS/rest/services/Functional_Classification_TDA/FeatureServer/',
            supportsPagination: false,
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fetchAllFC: false,
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'FUNCLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCLASS'], maxRecordCount: 1000, supportsPagination: false,
                    roadTypeMap: { Fw: ['01', '11'], Ew: ['02', '12'], MH: ['04', '14'], mH: ['06', '16'], PS: ['07', '08', '17', '18'] }
                }
            ],
            information: { Source: 'FDOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                return null;
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        GA: {
            baseUrl: 'https://maps.itos.uga.edu/arcgis/rest/services/GDOT/GDOT_FunctionalClass/mapserver/',
            supportsPagination: true,
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fetchAllFC: false,
            fcMapLayers: [
                { layerID: 0, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'SYSTEM_CODE'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 1, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'SYSTEM_CODE'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 2, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'SYSTEM_CODE'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 3, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'SYSTEM_CODE'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 4, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'SYSTEM_CODE'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 5, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'SYSTEM_CODE'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 6, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'SYSTEM_CODE'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } }
            ],
            information: { Source: 'GDOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Federal and State highways set to a minimum of mH.' },
            getWhereClause: function (context) {
                return null;
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    var attr = feature.attributes;
                    var fc = attr.FUNCTIONAL_CLASS;
                    if (attr.SYSTEM_CODE === '1' && fc > 4) {
                        return _stateSettings.global.getRoadTypeFromFC(4, layer);
                    } else {
                        return _stateSettings.global.getFeatureRoadType(feature, layer);
                    }
                }
            }
        },
        HI: {
            baseUrl: 'http://geodata.hawaii.gov/arcgis/rest/services/Transportation/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 12, fcPropName: 'funsystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'funsystem'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'HDOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>7";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        ID: {
            baseUrl: 'https://gis.itd.idaho.gov/arcgisprod/rest/services/IPLAN/Functional_Classification/MapServer/',
            supportsPagination: false,
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fetchAllFC: true,
            fcMapLayers: [
                { layerID: 0, fcPropName: 'FCCODE', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FCCODE'], maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 1, fcPropName: 'FCCODE', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FCCODE'], maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 2, fcPropName: 'FCCODE', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FCCODE'], maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 3, fcPropName: 'FCCODE', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FCCODE'], maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 4, fcPropName: 'FCCODE', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FCCODE'], maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } },
                { layerID: 5, fcPropName: 'FCCODE', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FCCODE'], maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6] } }
            ],
            information: { Source: 'ITD', Permission: 'Visible to R4+ or R3-AM', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                return null;
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        IL: {
            baseUrl: 'http://ags10s1.dot.illinois.gov/ArcGIS/rest/services/IRoads/IRoads_53/MapServer/',
            supportsPagination: false,
            defaultColors: { Fw: '#ff00c5', Ew: '#ff00c5', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee', CH: '#ff5e0e' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1] },
            fcMapLayers: [
                {
                    layerID: 3, idPropName: 'OBJECTID', fcPropName: 'FC', outFields: ['FC', 'MRK_RT_TYP', 'CH', 'OBJECTID'],
                    roadTypeMap: { Fw: ['1'], Ew: ['2'], MH: ['3'], mH: ['4'], PS: ['5', '6'], St: ['7'] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            isPermitted: function () { return _r >= 4; },
            information: { Source: 'IDOT', Permission: 'Visible to R4+' },
            getWhereClause: function (context) {
                return context.mapContext.zoom < 4 ? "FC<>7" : null;
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = attr.FC;
                var type = attr.MRK_RT_TYP;
                if (fc > 3 && type === 'U') { // US Route
                    fc = 3;
                } else if (fc > 4 && type === 'S') { // State Route
                    fc = 4;
                } else if (fc > 6 && attr.CH !== '0000') { // County Route
                    fc = 6;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        IN: {
            baseUrl: 'https://gis.in.gov/arcgis/rest/services/DOT/INDOT_LTAP/FeatureServer/',
            supportsPagination: false,
            overrideUrl: '1Sbwc7e6BfHpZWSTfU3_1otXGSxHrdDYcbn7fOf1VjpA',
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []], hideRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 10, idPropName: 'OBJECTID', fcPropName: 'FUNCTIONAL_CLASS', outFields: ['FUNCTIONAL_CLASS', 'OBJECTID', 'TO_DATE'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 100000, supportsPagination: false
                }
            ],
            isPermitted: function () { return true; },
            information: { Source: 'INDOT', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                var whereParts = ['TO_DATE IS NULL'];
                if (context.mapContext.zoom < 4) {
                    whereParts += ' AND ' + context.layer.fcPropName + '<>7';
                }
                return whereParts;
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        IA: {
            baseUrl: 'https://gis.iowadot.gov/public/rest/services/RAMS/Road_Network/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee', PSGr: '#cc6533', StGr: '#e99cb6' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'FED_FUNCTIONAL_CLASS', idPropName: 'OBJECTID',
                    outFields: ['OBJECTID', 'FED_FUNCTIONAL_CLASS', 'STATE_ROUTE_NAME_1', 'ACCESS_CONTROL', 'SURFACE_TYPE'],
                    roadTypeMap: { Fw: [1], MH: [2, 3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'Iowa DOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Additional colors denote unpaved PS and LS segements.' },
            getWhereClause: function (context) {
                var theWhereClause = "FACILITY_TYPE<>'7'"; // Removed proposed roads
                if (context.mapContext.zoom < 4) {
                    theWhereClause += " AND " + context.layer.fcPropName + "<>'7'";
                }
                return theWhereClause;
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr[layer.fcPropName]);
                var isFw = attr.ACCESS_CONTROL === 1;
                var isUS = RegExp('^STATE OF IOWA, US').test(attr.STATE_ROUTE_NAME_1);
                var isState = RegExp('^STATE OF IOWA, IA').test(attr.STATE_ROUTE_NAME_1);
                if (isFw) {
                    fc = 1;
                } else if (fc > 3 && isUS) {
                    fc = 3;
                } else if (fc > 4 && isState) {
                    fc = 4;
                }
                if (fc > 4 && attr.SURFACE_TYPE === 20) {
                    return fc < 7 ? 'PSGr' : 'StGr';
                } else {
                    return _stateSettings.global.getRoadTypeFromFC(fc, layer);
                }
            }
        },
        KS: {
            baseUrl: 'http://wfs.ksdot.org/arcgis_web_adaptor/rest/services/Transportation/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, layerPath: 'Non_State_System/MapServer/', idPropName: 'ID2', fcPropName: 'FUNCLASS', outFields: ['FUNCLASS', 'ID2', 'ROUTE_ID'],
                    roadTypeMap: { Fw: [1], MH: [2, 3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 0, layerPath: 'State_System/MapServer/', idPropName: 'OBJECTID', fcPropName: 'FUN_CLASS_CD', outFields: ['FUN_CLASS_CD', 'OBJECTID', 'PREFIX', 'ACCESS_CONTROL'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'KDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>'7'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr[layer.fcPropName]);
                var roadPrefix = attr.PREFIX;
                var isUS = roadPrefix === 'U';
                var isState = roadPrefix === 'K';
                if ((fc > 3 && isUS) || (fc === 2 && parseInt(attr.ACCESS_CONTROL) !== 1)) {
                    fc = 3;
                } else if (fc > 4 && isState) {
                    fc = 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            },
        },
        KY: {
            baseUrl: 'https://maps.kytc.ky.gov/arcgis/rest/services/BaseMap/System/MapServer/',
            supportsPagination: false,
            defaultColors: { Fw: '#ff00c5', Ew: '#ff00c5', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1] },
            fcMapLayers: [
                {
                    layerID: 0, idPropName: 'OBJECTID', fcPropName: 'FC', outFields: ['FC', 'OBJECTID', 'RT_PREFIX', 'RT_SUFFIX'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            isPermitted: function () { return true; },
            information: { Source: 'KYTC' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>'7'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr[layer.fcPropName]);
                if (fc > 3 && attr.RT_PREFIX === 'US') {
                    var suffix = attr.RT_SUFFIX;
                    fc = (suffix && suffix.indexOf('X') > -1) ? 4 : 3;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        LA: {
            baseUrl: 'https://giswebnew.dotd.la.gov/arcgis/rest/services/Transportation/LA_RoadwayFunctionalClassification/FeatureServer/',
            supportsPagination: false,
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                { layerID: 0, fcPropName: 'FunctionalSystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalSystem', 'RouteID'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false },
                { layerID: 1, fcPropName: 'FunctionalSystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalSystem', 'RouteID'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false },
                { layerID: 2, fcPropName: 'FunctionalSystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalSystem', 'RouteID'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false },
                { layerID: 3, fcPropName: 'FunctionalSystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalSystem', 'RouteID'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false },
                { layerID: 4, fcPropName: 'FunctionalSystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalSystem', 'RouteID'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false },
                { layerID: 5, fcPropName: 'FunctionalSystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalSystem', 'RouteID'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false },
                { layerID: 6, fcPropName: 'FunctionalSystem', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FunctionalSystem', 'RouteID'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false }
            ],
            information: { Source: 'LaDOTD', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>'7'"; // OR State_Route LIKE 'US%' OR State_Route LIKE 'LA%'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = feature.attributes[layer.fcPropName];
                if (fc === '2a' || fc === '2b') { fc = 2; }
                fc = parseInt(fc);
                var route = feature.attributes.RouteID.split('_')[1].trim();
                var isUS = /^US \d/.test(route);
                var isState = /^LA \d/.test(route);
                var isBiz = / BUS$/.test(route);
                if (fc > 3 && isUS) {
                    fc = isBiz ? 4 : 3;
                } else if (fc > 4 && isState) {
                    fc = isBiz ? 5 : 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        ME: {
            baseUrl: 'https://arcgisserver.maine.gov/arcgis/rest/services/mdot/MaineDOT_Dynamic/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 800, fcPropName: 'fedfunccls', idPropName: 'objectid', outFields: ['objectid', 'fedfunccls', 'prirtename'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'MaineDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>'Local'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = attr[layer.fcPropName];
                switch (fc) {
                    case 'Interstate': fc = 1; break;
                    case 'Other Freeway or Expressway': fc = 2; break;
                    case 'Other Principal Arterial': fc = 3; break;
                    case 'Minor Arterial': fc = 4; break;
                    case 'Major Collector':
                    case 'Minor Collector': fc = 5; break;
                    default: fc = 7;
                }
                var route = attr.prirtename;
                var isUS = RegExp(/^US \d/).test(route);
                var isState = RegExp(/^ST RTE \d/).test(route);
                var isBiz = (isUS && RegExp(/(1B|1BS)$/).test(route)) || (isState && RegExp(/(15B|24B|25B|137B)$/).test(route));
                if (fc > 3 && isUS) {
                    fc = isBiz ? 4 : 3;
                } else if (fc > 4 && isState) {
                    fc = isBiz ? 5 : 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        MD: {
            baseUrl: 'https://geodata.md.gov/imap/rest/services/Transportation/MD_HighwayPerformanceMonitoringSystem/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#ffff00', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                { layerID: 2, fcPropName: 'FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS', 'ID_PREFIX', 'MP_SUFFIX'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false }
            ],
            information: { Source: 'MDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return "(FUNCTIONAL_CLASS < 7 OR ID_PREFIX IN('MD'))";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr.FUNCTIONAL_CLASS);
                var isUS = attr.ID_PREFIX === 'US';
                var isState = attr.ID_PREFIX === 'MD';
                var isBiz = attr.MP_SUFFIX === 'BU';
                if (fc > 3 && isUS) {
                    fc = isBiz ? 4 : 3;
                } else if (fc > 4 && isState) {
                    fc = isBiz ? 5 : 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        MA: {
            baseUrl: 'https://gis.massdot.state.ma.us/arcgis/rest/services/Roads/RoadInventory/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'F_F_Class', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'F_F_Class', 'Route_ID'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'MDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>'7'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr[layer.fcPropName]);
                var route = attr.Route_ID;
                var isUS = /^US\d/.test(route);
                var isState = /^SR\d/.test(route);
                if (fc > 3 && isUS) {
                    fc = 3;
                } else if (fc > 4 && isState) {
                    fc = 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        MI: {
            baseUrl: 'https://gisp.mcgi.state.mi.us/arcgis/rest/services/MDOT/NFC/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                { layerID: 2, idPropName: 'OBJECTID', fcPropName: 'NFC', outFields: ['NFC'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false }
            ],
            isPermitted: function () { return true; },
            information: { Source: 'MDOT', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + '<>7';
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        MO: {
            baseUrl: 'http://mapping.modot.org/external/rest/services/BaseMap/TmsUtility/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 5, fcPropName: 'FUNC_CLASS_NAME', idPropName: 'SS_PAVEMENT_ID', outFields: ['SS_PAVEMENT_ID', 'FUNC_CLASS_NAME', 'TRAVELWAY_DESG', 'TRAVELWAY_NAME', 'ACCESS_CAT_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            isPermitted: function () { return _r >= 3 || (_r >= 2 && _isAM); },
            information: { Source: 'MoDOT', Permission: 'Visible to R3+ or R2-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 1) {
                    return '1=0'; //WME very laggy at zoom 0
                } else {
                    // Remove duplicate rows, but suss out interstate business loops
                    return "FUNC_CLASS_NAME <> ' ' AND (TRAVELWAY_ID = CNTL_TW_ID OR (TRAVELWAY_ID <> CNTL_TW_ID AND TRAVELWAY_DESG = 'LP'))";
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = attr[layer.fcPropName];
                var rtType = attr.TRAVELWAY_DESG;
                var route = attr.TRAVELWAY_NAME;
                switch (fc) {
                    case 'INTERSTATE': fc = 1; break;
                    case 'FREEWAY': fc = 2; break;
                    case 'PRINCIPAL ARTERIAL': fc = 3; break;
                    case 'MINOR ARTERIAL': fc = 4; break;
                    case 'MAJOR COLLECTOR': fc = 5; break
                    case 'MINOR COLLECTOR': fc = 6; break;
                    default: fc = 8; // not a typo
                }
                var usHwys = ['24', '36', '40', '50', '54', '56', '59', '60', '61', '62', '63', '65', '67', '69', '71', '136', '159', '160', '166', '169', '275', '400', '412'];
                var isUS = ['US', 'LP'].includes(rtType); // is US or interstate biz
                var isState = ['MO', 'AL'].includes(rtType);
                var isSup = rtType === 'RT';
                var isBiz = ['BU', 'SP'].includes(rtType) || /BUSINESS .+ \d/.test(route);
                var isUSBiz = isBiz && usHwys.includes(route);
                if ((fc === 2 && attr.ACCESS_CAT_NAME !== 'FULL') || (fc > 3 && isUS)) {
                    fc = 3;
                } else if (fc > 4 && (isState || isUSBiz)) {
                    fc = 4;
                } else if (fc > 6 && (isSup || isBiz)) {
                    fc = 6;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        MT: {
            baseUrl: 'https://app.mdt.mt.gov/arcgis/rest/services/Standard/ROUTES/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                { layerID: 0, fcPropName: 'FC', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FC', 'SIGN_ROUTE', 'ROUTE_NAME'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false },
                { layerID: 1, fcPropName: 'FC', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FC', 'SIGN_ROUTE', 'ROUTE_NAME'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false }
            ],
            isPermitted: function () { return _r >= 3; },
            information: { Source: 'MDT', Permission: 'Visible to R3+' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>'LOCAL'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = feature.attributes.FC;
                switch (fc) {
                    case 'PRINCIPAL ARTERIAL - INTERSTATE': fc = 1; break;
                    case 'PRINCIPAL ARTERIAL - NON-INTERSTATE': fc = 3; break;
                    case 'MINOR ARTERIAL': fc = 4; break;
                    case 'MAJOR COLLECTOR':
                    case 'MINOR COLLECTOR': fc = 5; break;
                    default: fc = 7;
                }
                var roadID = feature.attributes.SIGN_ROUTE;
                if (!roadID) { roadID = feature.attributes.ROUTE_NAME; }
                var isUS = RegExp(/^US \d+/).test(roadID);
                var isState = RegExp(/^MONTANA \d+|ROUTE \d+|S \d{3}\b/).test(roadID);
                if (fc > 3 && isUS) { fc = 3; }
                else if (fc > 4 && isState) { fc = 4; }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        NH: {
            baseUrl: 'https://nhgeodata.unh.edu/nhgeodata/rest/services/GRANITView/GV_BaseLayers/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 18, fcPropName: 'FUNCT_SYSTEM', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCT_SYSTEM', 'STREET_ALIASES', 'TIER'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [2, 3], mH: [4], PS: [5, 6], St: [7, 0] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            isPermitted: function () { return _r >= 3; },
            information: { Source: 'NH GRANIT', Permission: 'Visible to R3+' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>7 AND " + context.layer.fcPropName + "<>0";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = parseInt(feature.attributes[layer.fcPropName]);
                if (!(fc > 0)) { fc = 7; }
                var route = feature.attributes.STREET_ALIASES;
                var isUS = RegExp(/US /).test(route);
                var isState = RegExp(/NH /).test(route);
                if (fc === 2) { feature.attributes.TIER === 1 ? fc = 1 : fc = 3; }
                else if (fc > 3 && isUS) { RegExp(/US 3B/).test(route) ? fc = 4 : fc = 3; }
                else if (fc > 4 && isState) { fc = 4; }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        NM: {
            baseUrl: 'https://services.arcgis.com/hOpd7wfnKm16p9D9/ArcGIS/rest/services/NMDOT_Functional_Class/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#ff00c5', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'Func_Class', idPropName: 'OBJECTID_1', maxRecordCount: 1000, supportsPagination: false,
                    outFields: ['OBJECTID_1', 'Func_Class', 'D_RT_ROUTE'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }
                }
            ],
            isPermitted: function () { return true; },
            information: { Source: 'NMDOT' },
            getWhereClause: function (context) {
                return null;
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = parseInt(feature.attributes[layer.fcPropName]);
                var roadType = feature.attributes.D_RT_ROUTE.split('-', 1).shift();
                var isBiz = roadType === 'BL'; // Interstate Business Loop
                var isUS = roadType === 'US';
                var isState = roadType === 'NM';
                if (roadType === 'IX') { fc = 0; }
                else if (fc > 3 && (isBiz || isUS)) { fc = 3; }
                else if (fc > 4 && isState) { fc = 4; }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        NY: {//https://gis3.dot.ny.gov/arcgis/rest/services/Basemap/MapServer/21
            baseUrl: 'https://gis3.dot.ny.gov/arcgis/rest/services/',
            defaultColors: { Fw: '#ff00c5', Ew: '#5f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1] },
            fcMapLayers: [
                {
                    layerID: 'FC/MapServer/1', fcPropName: 'FUNC_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNC_CLASS', 'SEGMENT_NAME', 'ROUTE_NO'], roadTypeMap: { Fw: [1, 11], Ew: [2, 12], MH: [4, 14], mH: [6, 16], PS: [7, 8, 17, 18] },
                    maxRecordCount: 1000, supportsPagination: false
                },
                { layerID: 'Basemap/MapServer/21', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'SHIELD'], maxRecordCount: 1000, supportsPagination: false }
            ],
            information: { Source: 'NYSDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.layer.layerID === 'Basemap/MapServer/21') {
                    return ("SHIELD IN ('C','CT')");
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var roadType;
                if (layer.layerID === 'Basemap/MapServer/21') {
                    roadType = 'PS';
                } else {
                    roadType = _stateSettings.global.getFeatureRoadType(feature, layer);
                    var routeNo = feature.attributes.ROUTE_NO;
                    if (/^NY.*/.test(routeNo)) {
                        if (roadType === 'PS') roadType = 'mH';
                    } else if (/^US.*/.test(routeNo)) {
                        if (roadType === 'PS' || roadType === 'mH') roadType = 'MH';
                    }
                }
                return roadType;
            }
        },
        NC: {
            baseUrl: 'https://gis11.services.ncdot.gov/arcgis/rest/services/NCDOT_FunctionalClassQtr/MapServer/',
            defaultColors: { Fw: '#ff00c5', Rmp: '#999999', Ew: '#5f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                { layerID: 0, fcPropName: 'FuncClass', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FuncClass', 'RouteClass'], roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, zoomLevels: [3, 4, 5, 6, 7, 8, 9, 10], maxRecordCount: 1000, supportsPagination: false }
                //{ layerID:2, fcPropName:'FC_TYP_CD', idPropName:'OBJECTID', outFields:['OBJECTID','FC_TYP_CD','RTE_1_CLSS_CD'], roadTypeMap:{Fw:[1],Ew:[2],MH:[3],mH:[4],PS:[5,6],St:[7]}, zoomLevels:[2], maxRecordCount:1000, supportsPagination:false },
                //{ layerID:3, fcPropName:'FC_TYP_CD', idPropName:'OBJECTID', outFields:['OBJECTID','FC_TYP_CD','RTE_1_CLSS_CD'], roadTypeMap:{Fw:[1],Ew:[2],MH:[3],mH:[4],PS:[5,6],St:[7]}, zoomLevels:[0,1], maxRecordCount:1000, supportsPagination:false },
                //{ layerID:4, fcPropName:'FC_TYP_CD', idPropName:'OBJECTID', outFields:['OBJECTID','FC_TYP_CD','RTE_1_CLSS_CD'], roadTypeMap:{Fw:[1],Ew:[2],MH:[3],mH:[4],PS:[5,6],St:[7]}, zoomLevels:[], maxRecordCount:1000, supportsPagination:false },
                //{ layerID:5, fcPropName:'FC_TYP_CD', idPropName:'OBJECTID', outFields:['OBJECTID','FC_TYP_CD','RTE_1_CLSS_CD'], roadTypeMap:{Fw:[1],Ew:[2],MH:[3],mH:[4],PS:[5,6],St:[7]}, zoomLevels:[], maxRecordCount:1000, supportsPagination:false },
                //{ layerID:6, fcPropName:'FC_TYP_CD', idPropName:'OBJECTID', outFields:['OBJECTID','FC_TYP_CD','RTE_1_CLSS_CD'], roadTypeMap:{Fw:[1],Ew:[2],MH:[3],mH:[4],PS:[5,6],St:[7]}, zoomLevels:[], maxRecordCount:1000, supportsPagination:false }
            ],
            isPermitted: function () { return _r >= 3; },
            information: { Source: 'NCDOT', Permission: 'Visible to R3+' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    var clause = '(' + context.layer.fcPropName + " < 7 OR RouteClass IN ('I','FED','NC','RMP','US'))";
                    return clause;
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = feature.attributes[layer.fcPropName];
                var roadType;
                switch (this.getHwySys(feature)) {
                    case 'interstate':
                        roadType = 'Fw';
                        break;
                    case 'us':
                        roadType = fc <= 2 ? 'Ew' : 'MH';
                        break;
                    case 'state':
                        roadType = fc === 2 ? 'Ew' : (fc === 3 ? 'MH' : 'mH');
                        break;
                    case 'ramp':
                        roadType = 'Rmp';
                        break;
                    default:
                        roadType = fc === 2 ? 'Ew' : (fc === 3 ? 'MH' : (fc === 4 ? 'mH' : (fc <= 6 ? 'PS' : 'St')));
                }
                return roadType;
            },
            getHwySys: function (feature) {
                var hwySys;
                switch (feature.attributes.RouteClass) {
                    case '1':
                        hwySys = 'interstate';
                        break;
                    case '2':
                        hwySys = 'us';
                        break;
                    case '3':
                        hwySys = 'state';
                        break;
                    case '80':
                        hwySys = 'ramp';
                        break;
                    default:
                        hwySys = 'local';
                }
                return hwySys;
            }
        },
        ND: {
            baseUrl: 'https://gis.dot.nd.gov/arcgis/rest/services/external/transinfo/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 10, fcPropName: 'FUNCTION_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTION_CLASS'], roadTypeMap: { Fw: ['Interstate'], MH: ['Principal Arterial'], mH: ['Minor Arterial'], PS: ['Major Collector', 'Collector'], St: ['Local'] },
                    maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 11, fcPropName: 'FUNCTION_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTION_CLASS'], roadTypeMap: { Fw: ['Interstate'], MH: ['Principal Arterial'], mH: ['Minor Arterial'], PS: ['Major Collector', 'Collector'], St: ['Local'] },
                    maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 12, fcPropName: 'FUNCTION_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTION_CLASS'], roadTypeMap: { PS: ['Major Collector', 'Collector'] },
                    maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 16, fcPropName: 'SYSTEM_CD', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'SYSTEM_CD', 'SYSTEM_DESC', 'HIGHWAY', 'HWY_SUFFIX'], roadTypeMap: { Fw: [1, 11], MH: [2, 14], mH: [6, 7, 16, 19] },
                    maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'NDDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    if (context.layer.layerID !== 16) return context.layer.fcPropName + "<>'Local'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                return _stateSettings.global.getFeatureRoadType(feature, layer);
            }
        },
        OH: {
            baseUrl: 'https://gis.dot.state.oh.us/arcgis/rest/services/TIMS/Roadway_Information/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },

            fcMapLayers: [
                {
                    layerID: 8, fcPropName: 'FUNCTION_CLASS', idPropName: 'ObjectID', outFields: ['FUNCTION_CLASS', 'ROUTE_TYPE', 'ROUTE_NBR', 'ObjectID'],
                    maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }
                }
            ],
            isPermitted: function () { return true; },
            information: { Source: 'ODOT' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    var clause = '(' + context.layer.fcPropName + " < 7 OR ROUTE_TYPE IN ('CR','SR','US'))";
                    return clause;
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = feature.attributes[layer.fcPropName];
                var prefix = feature.attributes.ROUTE_TYPE;
                var isUS = prefix === 'US';
                var isState = prefix === 'SR';
                var isCounty = prefix === 'CR';
                if (isUS && fc > 3) { fc = 3; }
                if (isState && fc > 4) { fc = 4; }
                if (isCounty && fc > 6) { fc = 6; }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        OK: {
            baseUrl: 'https://services6.arcgis.com/RBtoEUQ2lmN0K3GY/arcgis/rest/services/Roadways/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'FUNCTIONALCLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONALCLASS', 'FHWAPRIMARYROUTE', 'ODOTROUTECLASS', 'ACCESSCONTROL'],
                    maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }
                }
            ],
            information: { Source: 'ODOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + " < 7 OR ODOTROUTECLASS IN ('U','S','I')";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = feature.attributes[layer.fcPropName];
                var route = (feature.attributes.FHWAPRIMARYROUTE || '').trim();
                var isBusinessOrSpur = /BUS$|SPR$/i.test(route);
                var prefix = isBusinessOrSpur ? route.substring(0, 1) : feature.attributes.ODOTROUTECLASS;
                var isFw = parseInt(feature.attributes.ACCESSCONTROL) === 1;
                var isInterstate = prefix === 'I';
                var isUS = prefix === 'U';
                var isState = prefix === 'S';
                if (isFw) { fc = 1; }
                else if (fc > 3 && ((isUS && !isBusinessOrSpur) || (isInterstate && isBusinessOrSpur))) { fc = 3; }
                else if (fc > 4 && ((isUS && isBusinessOrSpur) || (isState && !isBusinessOrSpur))) { fc = 4; }
                else if (fc > 5 && isState && isBusinessOrSpur) { fc = 5; }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        OR: {
            baseUrl: 'https://gis.odot.state.or.us/arcgis/rest/services/transgis/data_catalog_display/Mapserver/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 78, fcPropName: 'NEW_FC_CD', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'NEW_FC_CD'],
                    roadTypeMap: { Fw: ['1'], Ew: ['2'], MH: ['3'], mH: ['4'], PS: ['5', '6'], St: ['7'] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 80, fcPropName: 'NEW_FC_CD', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'NEW_FC_CD'],
                    roadTypeMap: { Fw: ['1'], Ew: ['2'], MH: ['3'], mH: ['4'], PS: ['5', '6'], St: ['7'] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'ODOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + " <> '7'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        PA: {
            baseUrl: 'https://www.pdarcgissvr.pa.gov/penndotgis/rest/services/PennShare/PennShare/MapServer/',
            supportsPagination: false,
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 3, features: new Map(), fcPropName: 'FUNC_CLS', idPropName: 'MSLINK', outFields: ['MSLINK', 'FUNC_CLS'],
                    maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: ['01', '11'], Ew: ['12'], MH: ['02', '14'], mH: ['06', '16'], PS: ['07', '08', '17'], St: ['09', '19'] }
                }
            ],
            isPermitted: function () { return _r >= 4; },
            information: { Source: 'PennDOT', Permission: 'Visible to R4+', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                return (context.mapContext.zoom < 4) ? context.layer.fcPropName + " NOT IN ('09','19')" : null;
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    var fc = feature.attributes[layer.fcPropName];
                    return _stateSettings.global.getRoadTypeFromFC(fc, layer);
                }
            }
        },
        RI: {
            baseUrl: 'https://services2.arcgis.com/S8zZg9pg23JUEexQ/arcgis/rest/services/RIDOT_Roads_2016/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [[], [], [], [], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'F_SYSTEM', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'F_SYSTEM', 'ROADTYPE', 'RTNO'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7, 0] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            isPermitted: function () { return _r >= 3; },
            information: { Source: 'RIDOT', Permission: 'Visible to R3+' },
            getWhereClause: function (context) {
                return (context.mapContext.zoom < 4) ? context.layer.fcPropName + " NOT IN (7,0)" : null;
            },
            getFeatureRoadType: function (feature, layer) {
                var fc = parseInt(feature.attributes[layer.fcPropName]);
                var type = feature.attributes.ROADTYPE;
                var rtnum = feature.attributes.RTNO;
                if (fc === 2 && ['10', '24', '37', '78', '99', '138', '403'].includes(rtnum)) { fc = 1; } //isFw
                else if ((fc > 3 && type === 'US') || rtnum === '1') { fc = 3; } //isUS
                else if (fc > 4 && rtnum.trim() !== '') { fc = 4; } //isState
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        SC: {
            baseUrl: 'https://services1.arcgis.com/VaY7cY9pvUYUP1Lf/arcgis/rest/services/Functional_Class/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'FC_GIS', idPropName: 'FID', outFields: ['FID', 'FC_GIS', 'ROUTE_LRS'],
                    maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }
                }
            ],
            isPermitted: function () { return _r >= 4; },
            information: { Source: 'SCDOT', Permission: 'Visible to R4+' },
            getWhereClause: function (context) {
                return null;
            },
            getFeatureRoadType: function (feature, layer) {
                var roadID = feature.attributes.ROUTE_LRS;
                var roadType = parseInt(roadID.slice(3, 4));
                var isFw = roadType === 1;
                var isUS = roadType === 2;
                var isState = roadType === 4;
                var isBiz = parseInt(roadID.slice(-2, -1)) === 7;
                var fc = 7;
                switch (feature.attributes[layer.fcPropName]) {
                    case 'INT': fc = 1; break;
                    case 'EXP': fc = 2; break;
                    case 'PRA': fc = 3; break;
                    case 'MIA': fc = 4; break;
                    case 'MAC':
                    case 'MIC': fc = 5; break;
                }
                if (fc > 1 && isFw) {
                    fc = 1;
                } else if (fc > 3 && isUS) {
                    fc = isBiz ? 4 : 3;
                } else if (fc > 4 && isState) {
                    fc = (isBiz ? 5 : 4);
                }
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getRoadTypeFromFC(fc, layer);
                }
            }
        },
        SD: {
            baseUrl: 'https://arcgis.sd.gov/arcgis/rest/services/DOT/LocalRoads/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#149ece', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee', PSGr: '#cc6533', StGr: '#e99cb6' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [{
                layerID: 1, fcPropName: 'FUNC_CLASS', idPropName: 'OBJECTID', maxRecordCount: 1000, supportsPagination: false,
                outFields: ['OBJECTID', 'FUNC_CLASS', 'SURFACE_TYPE', 'ROADNAME'],
                roadTypeMap: { Fw: [1, 11], Ew: [2, 12], MH: [4, 14], mH: [6, 16], PS: [7, 8, 17], St: [9, 19] }
            }],
            information: { Source: 'SDDOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Additional colors denote unpaved PS and LS segements.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + " NOT IN (9,19)";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = parseInt(attr[layer.fcPropName]) % 10;
                var isFw = attr.ACCESS_CONTROL === 1;
                var isUS = RegExp('^US HWY ', 'i').test(attr.ROADNAME);
                var isState = RegExp('^SD HWY ', 'i').test(attr.ROADNAME);
                var isBiz = RegExp('^(US|SD) HWY .* (E|W)?(B|L)$', 'i').test(attr.ROADNAME);
                var isPaved = parseInt(attr.SURFACE_TYPE) > 5;
                if (isFw) {
                    fc = 1;
                } else if (fc > 4 && isUS) {
                    fc = (isBiz ? 6 : 4);
                } else if (fc > 6 && isState) {
                    fc = (isBiz ? 7 : 6);
                }
                if (fc > 6 && !isPaved) {
                    return fc < 9 ? 'PSGr' : 'StGr';
                } else {
                    return _stateSettings.global.getRoadTypeFromFC(fc, layer);
                }
            }
        },
        TN: {
            baseUrl: 'https://',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', PS2: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1] },
            fcMapLayers: [
                {
                    layerPath: 'testuasiportal.shelbycountytn.gov/arcgis/rest/services/MPO/Webmap_2015_04_20_TMPO/MapServer/', maxRecordCount: 1000, supportsPagination: false,
                    layerID: 17, fcPropName: 'FuncClass', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FuncClass'],
                    roadTypeMap: { Fw: [1, 11], Ew: [2, 12], MH: [4, 14], mH: [6, 16], PS: [7, 17], PS2: [8, 18], St: [9, 19] }
                },
                {
                    layerPath: 'services3.arcgis.com/pXGyp7DHTIE4RXOJ/ArcGIS/rest/services/Functional_Classification/FeatureServer/', maxRecordCount: 1000, supportsPagination: false,
                    layerID: 0, fcPropName: 'FC_MPO', idPropName: 'FID', outFields: ['FID', 'FC_MPO'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }
                }
            ],
            information: {
                Source: 'Shelby County, Nashville Area MPO', Permission: 'Visible to R4+ or R3-AM',
                Description: 'Raw unmodified FC data for the Memphis and Nashville regions only.'
            },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + ' NOT IN (0,7,9,19)';
                } else {
                    return context.layer.fcPropName + ' <> 0';
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        TX: {
            baseUrl: 'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/ArcGIS/rest/services/TxDOT_Functional_Classification/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1] },
            fcMapLayers: [
                { layerID: 0, fcPropName: 'F_SYSTEM', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'F_SYSTEM', 'RTE_PRFX'], maxRecordCount: 1000, supportsPagination: false, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] } }
            ],
            isPermitted: function () { return _r >= 2; },
            information: { Source: 'TxDOT', Permission: 'Visible to R2+' },
            getWhereClause: function (context) {
                var where = " F_SYSTEM IS NOT NULL AND RTE_PRFX IS NOT NULL";
                if (context.mapContext.zoom < 4) {
                    where += ' AND ' + context.layer.fcPropName + " <> 7";
                }
                return where;
            },
            getFeatureRoadType: function (feature, layer) {
                // On-System:
                // IH=Interstate BF=Business FM
                // US=US Highway FM=Farm to Mkt
                // UA=US Alt. RM=Ranch to Mkt
                // UP=US Spur RR=Ranch Road
                // SH=State Highway PR=Park Road
                // SA=State Alt. RE=Rec Road
                // SL=State Loop RP=Rec Rd Spur
                // SS=State Spur FS=FM Spur
                // BI=Business IH RS=RM Spur
                // BU=Business US RU=RR Spur
                // BS=Business State PA=Principal Arterial
                // Off-System:
                // TL=Off-System Tollroad CR=County Road
                // FC=Func. Classified St. LS=Local Street
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    var fc = feature.attributes[layer.fcPropName];
                    var type = feature.attributes.RTE_PRFX.substring(0, 2).toUpperCase();
                    if (type === 'IH' && fc > 1) {
                        fc = 1;
                    } else if ((type === 'US' || type === 'BI' || type === 'UA') && fc > 3) {
                        fc = 3;
                    } else if ((type === 'UP' || type === 'BU' || type === 'SH' || type === 'SA') && fc > 4) {
                        fc = 4;
                    } else if ((type === 'SL' || type === 'SS' || type === 'BS') && fc > 6) {
                        fc = 6;
                    }
                    return _stateSettings.global.getRoadTypeFromFC(fc, layer);
                }
            }
        },
        UT: {
            baseUrl: 'https://maps.udot.utah.gov/arcgis/rest/services/Functional_Class/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 0, fcPropName: 'FC_CODE', idPropName: 'OBJECTID', outFields: ['*'/*'OBJECTID','FC_CODE'*/], roadTypeMap: { Fw: [1], Ew: [2, 20], MH: [3, 30], mH: [4, 40], PS: [5, 50, 6, 60], St: [7, 77] },
                    maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'TxDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                var clause = context.layer.fcPropName + '<=7';
                if (context.mapContext.zoom < 4) {
                    clause += ' OR ' + context.layer.fcPropName + '<7';
                }
                return clause;
            },
            getFeatureRoadType: function (feature, layer) {
                var routeId = feature.attributes.ROUTE_ID;
                var fc = feature.attributes.FC_CODE;
                if ([6, 40, 50, 89, 91, 163, 189, 191, 491].indexOf(routeId) > -1 && fc > 3) {
                    // US highway
                    fc = 3;
                } else if (routeId <= 491 && fc > 4) {
                    // State highway
                    fc = 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        VT: {
            baseUrl: 'https://maps.vtrans.vermont.gov/arcgis/rest/services/Master/General/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 39, fcPropName: 'FUNCL', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCL', 'HWYSIGN'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'TxDOT', Permission: 'Visible to R4+ or R3-AM' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + "<>7 AND " + context.layer.fcPropName + "<>0";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var roadID = feature.attributes.HWYSIGN;
                var fc = feature.attributes[layer.fcPropName];
                if (!(fc > 0)) { fc = 7; }
                var isUS = RegExp(/^U/).test(roadID);
                var isState = RegExp(/^V/).test(roadID);
                var isUSBiz = RegExp(/^B/).test(roadID);
                if (fc > 3 && isUS) {
                    fc = 3;
                } else if (fc > 4 && (isUSBiz || isState)) {
                    fc = 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        },
        VA: {
            baseUrl: 'https://services.arcgis.com/p5v98VHDX9Atv3l7/arcgis/rest/services/FC_2014_FHWA_Submittal1/FeatureServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#ff00c5', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                { layerID: 0, fcPropName: 'FUNCTIONAL_CLASS_ID', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FUNCTIONAL_CLASS_ID', 'RTE_NM'], maxRecordCount: 2000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] } },
                { layerID: 1, fcPropName: 'STATE_FUNCT_CLASS_ID', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'STATE_FUNCT_CLASS_ID', 'RTE_NM', 'ROUTE_NO'], maxRecordCount: 2000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] } },
                { layerID: 3, fcPropName: 'TMPD_FC', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'TMPD_FC', 'RTE_NM'], maxRecordCount: 2000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] } }
            ],
            information: { Source: 'VDOT', Permission: 'Visible to R4+ or R3-AM' },
            srExceptions: [217, 302, 303, 305, 308, 310, 313, 314, 315, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 339, 341, 342, 343, 344, 345, 346, 347, 348, 350, 353, 355, 357, 358, 361, 362, 363, 364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376, 377, 378, 379, 382, 383, 384, 385, 386, 387, 388, 389, 390, 391, 392, 393, 394, 396, 397, 398, 399, 785, 895],
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + '<>7';
                } else {
                    //NOTE: As of 9/14/2016 there does not appear to be any US/SR/VA labeled routes with FC = 7.
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    var fc = parseInt(feature.attributes[layer.fcPropName]);
                    var rtName = feature.attributes.RTE_NM;
                    var match = /^R-VA\s*(US|VA|SR)(\d{5})..(BUS)?/.exec(rtName);
                    var isBusiness = (match && (match !== null) && (match[3] === 'BUS'));
                    var isState = (match && (match !== null) && (match[1] === 'VA' || match[1] === 'SR'));
                    var rtNum = parseInt((layer.layerID === 1) ? feature.attributes.ROUTE_NO : (match ? match[2] : 99999));
                    var rtPrefix = match && match[1];
                    if (fc > 3 && rtPrefix === 'US') {
                        fc = isBusiness ? 4 : 3;
                    } else if (isState && fc > 4 && this.srExceptions.indexOf(rtNum) === -1 && rtNum < 600) {
                        fc = isBusiness ? 5 : 4;
                    }
                    return _stateSettings.global.getRoadTypeFromFC(fc, layer);
                }
            }
        },
        WA: {
            baseUrl: 'https://data.wsdot.wa.gov/arcgis/rest/services/FunctionalClass/WSDOTFunctionalClassMap/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 2, fcPropName: 'FederalFunctionalClassCode', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FederalFunctionalClassCode'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 1, fcPropName: 'FederalFunctionalClassCode', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FederalFunctionalClassCode'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 4, fcPropName: 'FederalFunctionalClassCode', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'FederalFunctionalClassCode'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'WSDOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Raw unmodified FC data.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + " <> 7";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    return _stateSettings.global.getFeatureRoadType(feature, layer);
                }
            }
        },
        WV: {
            baseUrl: 'https://gis.transportation.wv.gov/arcgis/rest/services/Routes/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#ff00c5', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                { layerID: 24, fcPropName: 'NAT_FUNCTIONAL_CLASS', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'NAT_FUNCTIONAL_CLASS', 'ROUTE_ID'], maxRecordCount: 1000, supportsPagination: true, roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] } }
            ],
            information: { Source: 'WV DOT'},
            isPermitted: function () { return true; },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + ' NOT IN (9,19)';
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                if (layer.getFeatureRoadType) {
                    return layer.getFeatureRoadType(feature);
                } else {
                    var fcCode = feature.attributes[layer.fcPropName];
                    var fc = fcCode;
                    if (fcCode === 11) fc = 1;
                    else if (fcCode === 4 || fcCode === 12) fc = 2;
                    else if (fcCode === 2 || fcCode === 14) fc = 3;
                    else if (fcCode === 6 || fcCode === 16) fc = 4;
                    else if (fcCode === 7 || fcCode === 17 || fcCode === 8 || fcCode === 18) fc = 5;
                    else fc = 7;
                    var id = feature.attributes.ROUTE_ID;
                    var prefix = id.substr(2, 1);
                    var isInterstate = false;
                    var isUS = false;
                    var isState = false;
                    switch (prefix) {
                        case '1':
                            isInterstate = true;
                            break;
                        case '2':
                            isUS = true;
                            break;
                        case '3':
                            isState = true;
                            break;
                    }
                    if (fc > 1 && isInterstate) { fc = 1; }
                    else if (fc > 3 && isUS) { fc = 3; }
                    else if (fc > 4 && isState) { fc = 4; }
                    return _stateSettings.global.getRoadTypeFromFC(fc, layer);
                }
            }
        },
        WY: {
            baseUrl: 'https://apps.wyoroad.info/arcgis/rest/services/ITSM/LAYERS/MapServer/',
            defaultColors: { Fw: '#ff00c5', Ew: '#4f33df', MH: '#149ece', mH: '#4ce600', PS: '#cfae0e', St: '#eeeeee' },
            zoomSettings: { maxOffset: [30, 15, 8, 4, 2, 1, 1, 1, 1, 1], excludeRoadTypes: [['St'], ['St'], ['St'], ['St'], [], [], [], [], [], [], []] },
            fcMapLayers: [
                {
                    layerID: 21, fcPropName: 'CLASSIFICATION', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'CLASSIFICATION', 'COMMON_ROUTE_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 22, fcPropName: 'CLASSIFICATION', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'CLASSIFICATION', 'COMMON_ROUTE_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 23, fcPropName: 'CLASSIFICATION', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'CLASSIFICATION', 'COMMON_ROUTE_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 24, fcPropName: 'CLASSIFICATION', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'CLASSIFICATION', 'COMMON_ROUTE_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 25, fcPropName: 'CLASSIFICATION', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'CLASSIFICATION', 'COMMON_ROUTE_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 26, fcPropName: 'CLASSIFICATION', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'CLASSIFICATION', 'COMMON_ROUTE_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                },
                {
                    layerID: 27, fcPropName: 'CLASSIFICATION', idPropName: 'OBJECTID', outFields: ['OBJECTID', 'CLASSIFICATION', 'COMMON_ROUTE_NAME'],
                    roadTypeMap: { Fw: [1], Ew: [2], MH: [3], mH: [4], PS: [5, 6], St: [7] }, maxRecordCount: 1000, supportsPagination: false
                }
            ],
            information: { Source: 'WYDOT', Permission: 'Visible to R4+ or R3-AM', Description: 'Minimum suggested FC.' },
            getWhereClause: function (context) {
                if (context.mapContext.zoom < 4) {
                    return context.layer.fcPropName + " <> 'Local'";
                } else {
                    return null;
                }
            },
            getFeatureRoadType: function (feature, layer) {
                var attr = feature.attributes;
                var fc = attr[layer.fcPropName];
                var route = attr.COMMON_ROUTE_NAME;
                switch (fc) {
                    case 'Interstate': fc = 1; break;
                    case 'Expressway': fc = 2; break;
                    case 'Principal Arterial': fc = 3; break;
                    case 'Minor Arterial': fc = 4; break;
                    case 'Major Collector': fc = 5; break
                    case 'Minor Collector': fc = 6; break;
                    default: fc = 7;
                }
                var isIntBiz = /I (25|80) BUS/.test(route);
                var isUS = /US \d+/.test(route);
                var isUSBiz = /US \d+ BUS/.test(route);
                var isState = /WY \d+/.test(route);
                var isStateBiz = /WY \d+ BUS/.test(route);
                if (fc > 3 && (isUS || isIntBiz)) {
                    fc = isUSBiz ? 4 : 3;
                } else if (fc > 4 && isState) {
                    fc = isStateBiz ? 5 : 4;
                }
                return _stateSettings.global.getRoadTypeFromFC(fc, layer);
            }
        }
    };

    function log(message, level) {
        if (message && (!level || (level <= _debugLevel))) {
            console.log('FC Layer: ', message);
        }
    }

    function dynamicSort(property) {
        var sortOrder = 1;
        if (property[0] === "-") {
            sortOrder = -1;
            property = property.substr(1);
        }
        return function (a, b) {
            var props = property.split('.');
            props.forEach(function (prop) {
                a = a[prop];
                b = b[prop];
            });
            var result = (a < b) ? -1 : (a > b) ? 1 : 0;
            return result * sortOrder;
        };
    }

    function dynamicSortMultiple() {
        /*
     * save the arguments object as it will be overwritten
     * note that arguments object is an array-like object
     * consisting of the names of the properties to sort by
     */
        var props = arguments;
        if (arguments[0] && Array.isArray(arguments[0])) {
            props = arguments[0];
        }
        return function (obj1, obj2) {
            var i = 0, result = 0, numberOfProperties = props.length;
            /* try getting a different result from 0 (equal)
         * as long as we have extra properties to compare
         */
            while (result === 0 && i < numberOfProperties) {
                result = dynamicSort(props[i])(obj1, obj2);
                i++;
            }
            return result;
        };
    }

    function generateUUID() {
        var d = new Date().getTime();
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (d + Math.random() * 16) % 16 | 0;
            d = Math.floor(d / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
        return uuid;
    }

    function loadSettingsFromStorage() {
        var loadedSettings = $.parseJSON(localStorage.getItem(_settingsStoreName));
        var defaultSettings = {
            lastVersion: null,
            layerVisible: true,
            activeStateAbbr: 'ALL',
            hideStreet: false
        };
        _settings = loadedSettings ? loadedSettings : defaultSettings;
        for (var prop in defaultSettings) {
            if (!_settings.hasOwnProperty(prop)) {
                _settings[prop] = defaultSettings[prop];
            }
        }
    }

    function saveSettingsToStorage() {
        if (localStorage) {
            _settings.lastVersion = _scriptVersion;
            _settings.layerVisible = _mapLayer.visibility;
            localStorage.setItem(_settingsStoreName, JSON.stringify(_settings));
            log('Settings saved', 1);
        }
    }

    function getLineWidth() {
        return 12 * Math.pow(1.15, (W.map.getZoom() - 1));
    }

    function sortArray(array) {
        array.sort(function (a, b) { if (a < b) return -1; if (a > b) return 1; else return 0; });
    }

    function getVisibleStateAbbrs() {
        var visibleStates = [];
        W.model.states.getObjectArray().forEach(function (state) {
            var stateAbbr = _statesHash[state.name];
            var activeStateAbbr = _settings.activeStateAbbr;
            if (_stateSettings[stateAbbr] && _stateSettings.global.isPermitted(stateAbbr) && (!activeStateAbbr || activeStateAbbr === 'ALL' || activeStateAbbr === stateAbbr)) {
                visibleStates.push(stateAbbr);
            }
        });
        return visibleStates;
    }

    function getAsync(url, context) {
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                context: context, method: "GET", url: url,
                onload: function (res) {
                    if (res.status.toString() === '200') {
                        resolve({ responseText: res.responseText, context: context });
                    } else {
                        reject({ responseText: res.responseText, context: context });
                    }
                },
                onerror: function () {
                    reject(Error("Network Error"));
                }
            });
        });
    }
    function wait(ms) {
        var start = new Date().getTime();
        var end = start;
        while (end < start + ms) {
            end = new Date().getTime();
        }
    }
    function getUrl(context, queryType, queryParams) {
        var extent = context.mapContext.extent,
            zoom = context.mapContext.zoom,
            layer = context.layer,
            state = context.state;

        var whereParts = [];
        var geometry = { xmin: extent.left, ymin: extent.bottom, xmax: extent.right, ymax: extent.top, spatialReference: { wkid: 102100, latestWkid: 3857 } };
        var geometryStr = JSON.stringify(geometry);
        var stateWhereClause = state.getWhereClause(context);
        var layerPath = layer.layerPath || '';
        var url = state.baseUrl + layerPath + layer.layerID + '/query?geometry=' + encodeURIComponent(geometryStr);

        if (queryType === 'countOnly') {
            url += '&returnCountOnly=true';
        } else if (queryType === 'idsOnly') {
            url += '&returnIdsOnly=true';
        } else if (queryType === 'paged') {
            // TODO
        } else {
            url += '&returnGeometry=true&maxAllowableOffset=' + state.zoomSettings.maxOffset[zoom];
            url += '&outFields=' + encodeURIComponent(layer.outFields.join(','));
            if (queryType === 'idRange') {
                var idPropName = context.layer.idPropName;
                whereParts.push('(' + queryParams.idFieldName + '>=' + queryParams.range[0] + ' AND ' + queryParams.idFieldName + '<=' + queryParams.range[1] + ')');
            }
        }
        if (stateWhereClause) whereParts.push(stateWhereClause);
        if (whereParts.length > 0) url += '&where=' + encodeURIComponent(whereParts.join(' AND '));
        url += '&spatialRel=esriSpatialRelIntersects&geometryType=esriGeometryEnvelope&inSR=102100&outSR=3857&f=json';
        //wait(500);  // I don't know why this was in the code.  Leaving it commented here just in case it was a hack to solve some issue.
        return url;
    }

    function convertFcToRoadTypeVectors(feature, state, stateAbbr, layer, zoom) {
        var roadType = state.getFeatureRoadType(feature, layer);
        log(feature, 3);
        var zIndex = _stateSettings.global.roadTypes.indexOf(roadType) * 100;
        var vectors = [];
        var lineFeatures = [];
        var attr = {
            //fcFeatureUniqueId: stateAbbr + '-' + layer.layerID + '-' + feature.attributes[layer.idPropName],
            //fcFeatureId: feature.attributes[layer.idPropName],
            state: stateAbbr,
            layerID: layer.layerID,
            roadType: roadType,
            dotAttributes: $.extend({}, feature.attributes),
            color: state.defaultColors[roadType],
            strokeWidth: getLineWidth,
            zIndex: zIndex
        };

        feature.geometry.paths.forEach(function (path) {
            var pointList = [];
            var newPoint = null;
            var lastPoint = null;
            path.forEach(function (point) {
                pointList.push(new OL.Geometry.Point(point[0], point[1]));
            });
            var vectorFeature = new OL.Feature.Vector(new OL.Geometry.LineString(pointList), attr);
            vectors.push(vectorFeature);
        });

        return vectors;
    }

    function fetchLayerFC(context) {
        var url = getUrl(context, 'idsOnly');
        log(url, 2);
        if (!context.parentContext.cancel) {
            return getAsync(url, context).bind(context).then(function (res) {
                var ids = $.parseJSON(res.responseText);
                if (!ids.objectIds) ids.objectIds = [];
                sortArray(ids.objectIds);
                log(ids, 2);
                return ids;
            }).then(function (res) {
                var context = this;
                var idRanges = [];
                if (res.objectIds) {
                    var len = res.objectIds ? res.objectIds.length : 0;
                    var currentIndex = 0;
                    var offset = Math.min(this.layer.maxRecordCount, 1000);
                    while (currentIndex < len) {
                        var nextIndex = currentIndex + offset;
                        if (nextIndex >= len) nextIndex = len - 1;
                        idRanges.push({ range: [res.objectIds[currentIndex], res.objectIds[nextIndex]], idFieldName: res.objectIdFieldName });
                        currentIndex = nextIndex + 1;
                    }
                    log(context.layer.layerID, 2);
                    log(idRanges, 2);
                }
                return idRanges;
            }).map(function (idRange) {
                var context = this;
                if (!context.parentContext.cancel) {
                    var url = getUrl(this, 'idRange', idRange);
                    log(url, 2);
                    return getAsync(url, context).then(function (res) {
                        var context = res.context;
                        if (!context.parentContext.cancel) {
                            var features = $.parseJSON(res.responseText).features;
                            // if (context.parentContext.callCount === 0 ) {
                            //     _mapLayer.removeAllFeatures();
                            // }
                            context.parentContext.callCount++;
                            log('Feature Count=' + (features ? features.length : 0), 2);
                            features = features ? features : [];
                            var vectors = [];
                            features.forEach(function (feature) {
                                if (!res.context.parentContext.cancel) {
                                    var vector = convertFcToRoadTypeVectors(feature, context.state, context.stateAbbr, context.layer, context.mapContext.zoom);
                                    //var fcFeatureUniqueId = vector[0].attributes.fcFeatureUniqueId;
                                    //context.parentContext.addedFcFeatureUniqueIds.push(fcFeatureUniqueId);
                                    if (/*!context.parentContext.existingFcFeatureUniqueIds[fcFeatureUniqueId] &&*/ !(vector[0].attributes.roadType === 'St' && _settings.hideStreet)) {
                                        vectors.push(vector);
                                    }
                                }
                            });
                            return vectors;
                        }
                    });
                } else {
                    log('Async call cancelled', 1);
                }
            });
        }
    }

    function fetchStateFC(context) {
        var state = _stateSettings[context.stateAbbr];
        var contexts = [];
        state.fcMapLayers.forEach(function (layer) {
            contexts.push({ parentContext: context.parentContext, layer: layer, state: state, stateAbbr: context.stateAbbr, mapContext: context.mapContext });
        });
        return Promise.map(contexts, function (context) {
            return fetchLayerFC(context);
        });
    }

    var _lastPromise = null;
    var _lastContext = null;
    var _fcCallCount = 0;
    function fetchAllFC() {
        if (!_mapLayer.visibility) return;

        if (_lastPromise) { _lastPromise.cancel(); }
        $('#fc-loading-indicator').text('Loading FC...');

        var mapContext = { zoom: W.map.getZoom(), extent: W.map.getExtent() };
        var contexts = [];
        var parentContext = { callCount: 0,/*existingFcFeatureUniqueIds:{}, addedFcFeatureUniqueIds:[],*/ startTime: Date.now() };
        // _mapLayer.features.forEach(function(vectorFeature) {
        //     var fcFeatureUniqueId = vectorFeature.attributes.fcFeatureUniqueId;
        //     var existingFcFeatureUniqueIdArray = parentContext.existingFcFeatureUniqueIds[fcFeatureUniqueId];
        //     if (!existingFcFeatureUniqueIdArray) {
        //         existingFcFeatureUniqueIdArray = [];
        //         parentContext.existingFcFeatureUniqueIds[fcFeatureUniqueId] = existingFcFeatureUniqueIdArray;
        //     }
        //     existingFcFeatureUniqueIdArray.push(vectorFeature);
        // });
        if (_lastContext) _lastContext.cancel = true;
        _lastContext = parentContext;
        getVisibleStateAbbrs().forEach(function (stateAbbr) {
            contexts.push({ parentContext: parentContext, stateAbbr: stateAbbr, mapContext: mapContext });
        });
        var map = Promise.map(contexts, function (context) {
            return fetchStateFC(context);
        }).bind(parentContext).then(function (statesVectorArrays) {
            if (!this.cancel) {
                _mapLayer.removeAllFeatures();
                statesVectorArrays.forEach(function (vectorsArray) {
                    vectorsArray.forEach(function (vectors) {
                        vectors.forEach(function (vector) {
                            vector.forEach(function (vectorFeature) {
                                _mapLayer.addFeatures(vectorFeature);
                            });
                        });
                    });
                });
                //buildTable();
                // for(var fcFeatureUniqueId in this.existingFcFeatureUniqueIds) {
                //     if(this.addedFcFeatureUniqueIds.indexOf(fcFeatureUniqueId) === -1) {
                //         if (!this.cancel) _mapLayer.removeFeatures(this.existingFcFeatureUniqueIds[fcFeatureUniqueId]);
                //     }
                // }
                log('TOTAL RETRIEVAL TIME = ' + (Date.now() - parentContext.startTime), 1);
                log(statesVectorArrays, 1);
            }
            return statesVectorArrays;
        }).catch(function (e) {
            $('#fc-loading-indicator').text('FC Error! (check console for details)');
            log(e, 0);
        }).finally(function () {
            _fcCallCount -= 1;
            if (_fcCallCount === 0) {
                $('#fc-loading-indicator').text('');
            }
        });

        _fcCallCount += 1;
        _lastPromise = map;
    }

    function onLayerCheckboxChanged(checked) {
        _mapLayer.setVisibility(checked);
    }

    function onLayerVisibilityChanged(evt) {
        _settings.layerVisible = _mapLayer.visibility;
        saveSettingsToStorage();
        if (_mapLayer.visibility) {
            fetchAllFC();
        }
    }

    function onModeChanged(model, modeId, context) {
        if (!modeId || modeId === 1) {
            initUserPanel();
        }
    }

    function showScriptInfoAlert() {
        /* Check version and alert on update */
        if (_alertUpdate && _scriptVersion !== _settings.lastVersion) {
            alert(_scriptVersionChanges);
        }
    }

    function initLayer() {
        var _drawingContext = {
            getZIndex: function (feature) {
                return feature.attributes.zIndex;
            },
            getStrokeWidth: function () { return getLineWidth(); }
        };
        var defaultStyle = new OL.Style({
            strokeColor: '${color}', //'#00aaff',
            strokeDashstyle: "solid",
            strokeOpacity: 1.0,
            strokeWidth: '${strokeWidth}',
            graphicZIndex: '${zIndex}'
        });

        var selectStyle = new OL.Style({
            //strokeOpacity: 1.0,
            strokeColor: '#000000'
        });

        _mapLayer = new OL.Layer.Vector("FC Layer", {
            uniqueName: "__FCLayer",
            displayInLayerSwitcher: false,
            rendererOptions: { zIndexing: true },
            styleMap: new OL.StyleMap({
                'default': defaultStyle,
                'select': selectStyle
            })
        });

        _mapLayer.setOpacity(0.5);

        I18n.translations[I18n.locale].layers.name.__FCLayer = "FC Layer";

        _mapLayer.displayInLayerSwitcher = true;
        _mapLayer.events.register('visibilitychanged', null, onLayerVisibilityChanged);
        _mapLayer.setVisibility(_settings.layerVisible);

        W.map.addLayer(_mapLayer);
        _mapLayer.setZIndex(_mapLayerZIndex);
        WazeWrap.Interface.AddLayerCheckbox('Display', 'FC Layer', _settings.layerVisible, onLayerCheckboxChanged);
        // Hack to fix layer zIndex.  Some other code is changing it sometimes but I have not been able to figure out why.
        // It may be that the FC layer is added to the map before some Waze code loads the base layers and forces other layers higher. (?)

        var checkLayerZIndex = function () {
            if (_mapLayer.getZIndex() != _mapLayerZIndex) {
                log("ADJUSTED FC LAYER Z-INDEX " + _mapLayerZIndex + ', ' + _mapLayer.getZIndex(), 1);
                _mapLayer.setZIndex(_mapLayerZIndex);
            }
        };

        setInterval(function () { checkLayerZIndex(); }, 200);

        W.map.events.register("moveend", W.map, function (e) {
            fetchAllFC();
            return true;
        }, true);
    }

    function initUserPanel() {
        var $tab = $('<li>').append($('<a>', { 'data-toggle': 'tab', href: '#sidepanel-fc-layer' }).text('FC'));
        var $panel = $('<div>', { class: 'tab-pane', id: 'sidepanel-fc-layer' });
        var $stateSelect = $('<select>', { id: 'fcl-state-select', class: 'form-control disabled', style: 'disabled' }).append($('<option>', { value: 'ALL' }).text('All'));
        // $stateSelect.change(function(evt) {
        //     _settings.activeStateAbbr = evt.target.value;
        //     saveSettingsToStorage();
        //     _mapLayer.removeAllFeatures();
        //     fetchAllFC();
        // });
        for (var stateAbbr in _stateSettings) {
            if (stateAbbr !== 'global') {
                $stateSelect.append($('<option>', { value: stateAbbr }).text(reverseStatesHash(stateAbbr)));
            }
        }

        var $hideStreet = $('<div>', { id: 'fcl-hide-street-container', class: 'controls-container' })
            .append($('<input>', { type: 'checkbox', name: 'fcl-hide-street', id: 'fcl-hide-street' }).prop('checked', _settings.hideStreet).click(function () {
                _settings.hideStreet = $(this).is(':checked');
                saveSettingsToStorage();
                _mapLayer.removeAllFeatures();
                fetchAllFC();
            }))
            .append($('<label>', { for: 'fcl-hide-street' }).text('Hide local street highlights'));

        $stateSelect.val(_settings.activeStateAbbr ? _settings.activeStateAbbr : 'ALL');

        $panel.append(
            $('<div>', { class: 'form-group' }).append(
                $('<label>', { class: 'control-label' }).text('Select a state')
            ).append(
                $('<div>', { class: 'controls', id: 'fcl-state-select-container' }).append(
                    $('<div>').append($stateSelect)
                )
            ),
            $hideStreet,
            $('<div>', { id: 'fcl-table-container' })
        );

        $panel.append($('<div>', { id: 'fcl-state-info' }));

        $panel.append(
            $('<div>', { style: 'margin-top:10px;font-size:10px;color:#999999;' })
                .append($('<div>').text('version ' + _scriptVersion))
                .append(
                    $('<div>').append(
                        $('<a>', { href: '#' /*, target:'__blank'*/ }).text('Discussion Forum (currently n/a)')
                    )
                )
        );

        $('#user-tabs > .nav-tabs').append($tab);
        $('#user-info > .flex-parent > .tab-content').append($panel);
        $('#fcl-state-select').change(function () {
            _settings.activeStateAbbr = this.value;
            saveSettingsToStorage();
            loadStateFCInfo();
            fetchAllFC();
        });
        loadStateFCInfo();
    }

    function loadStateFCInfo() {
        $('#fcl-state-info').empty();
        if (_stateSettings[_settings.activeStateAbbr]) {
            var stateInfo = _stateSettings[_settings.activeStateAbbr].information;
            var $panelStateInfo = $('<dl>');
            for (var propertyName in stateInfo) {
                $panelStateInfo.append($('<dt>', { style: 'margin-top:1em;color:#777777' }).text(propertyName))
                    .append($('<dd>').text(stateInfo[propertyName]))
            }
            $('#fcl-state-info').append($panelStateInfo);
        }
    }

    function addLoadingIndicator() {
        $('.loading-indicator').after($('<div class="loading-indicator" style="margin-right:10px" id="fc-loading-indicator">'));
    }

    function initGui() {
        addLoadingIndicator();
        initLayer();
        initUserPanel();
        showScriptInfoAlert();
    }

    function processText(text) {
        return new Promise(function (resolve, reject) {
            var newText = text.replace(/(e)/, 'E');
            resolve(newText);
        });
    }

    function init() {
        if (_debugLevel > 0 && Promise.config) {
            Promise.config({
                warnings: true,
                longStackTraces: true,
                cancellation: true,
                monitoring: false
            });
        } else {
            Promise.config({
                warnings: false,
                longStackTraces: false,
                cancellation: true,
                monitoring: false
            });
        }

        var u = W.loginManager.user;
        _uid = u.id;
        _r = u.rank + 1;
        _isAM = u.isAreaManager;
        loadSettingsFromStorage();
        String.prototype.replaceAll = function (search, replacement) {
            var target = this;
            return target.replace(new RegExp(search, 'g'), replacement);
        };
        initGui();
        W.app.modeController.model.bind('change:mode', onModeChanged);
        W.prefs.on("change:isImperial", function () { initUserPanel(); loadSettingsFromStorage(); });
        fetchAllFC();
        log('Initialized.', 0);
    }

    function bootstrap() {
        if (W && W.loginManager &&
            W.loginManager.events &&
            W.loginManager.events.register &&
            W.model && W.model.states && W.model.states.getObjectArray().length &&
            W.map && W.loginManager.user &&
            WazeWrap.Ready) {
            log('Initializing...', 0);

            init();
        } else {
            log('Bootstrap failed. Trying again...', 0);
            unsafeWindow.setTimeout(function () {
                bootstrap();
            }, 1000);
        }
    }

    log('Bootstrap...', 0);
    bootstrap();
})();
