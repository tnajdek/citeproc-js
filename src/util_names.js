/*
 * Copyright (c) 2009 and 2010 Frank G. Bennett, Jr. All Rights Reserved.
 *
 * The contents of this file are subject to the Common Public
 * Attribution License Version 1.0 (the “License”); you may not use
 * this file except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://bitbucket.org/fbennett/citeproc-js/src/tip/LICENSE.
 *
 * The License is based on the Mozilla Public License Version 1.1 but
 * Sections 14 and 15 have been added to cover use of software over a
 * computer network and provide for limited attribution for the
 * Original Developer. In addition, Exhibit A has been modified to be
 * consistent with Exhibit B.
 *
 * Software distributed under the License is distributed on an “AS IS”
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See
 * the License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is the citation formatting software known as
 * "citeproc-js" (an implementation of the Citation Style Language
 * [CSL]), including the original test fixtures and software located
 * under the ./std subdirectory of the distribution archive.
 *
 * The Original Developer is not the Initial Developer and is
 * __________. If left blank, the Original Developer is the Initial
 * Developer.
 *
 * The Initial Developer of the Original Code is Frank G. Bennett,
 * Jr. All portions of the code written by Frank G. Bennett, Jr. are
 * Copyright (c) 2009 and 2010 Frank G. Bennett, Jr. All Rights Reserved.
 */

CSL.Util.Names = {};

/**
 * Build a set of names, less any label or et al. tag
 */
CSL.Util.Names.outputNames = function (state, display_names) {
	var segments, and;
	segments = new this.StartMiddleEnd(state, display_names);
	and = state.output.getToken("name").strings.delimiter;
	if (state.output.getToken("name").strings["delimiter-precedes-last"] === "always") {
		and = state.output.getToken("inner").strings.delimiter + and;
	} else if (state.output.getToken("name").strings["delimiter-precedes-last"] === "never") {
		if (!and) {
			and = state.output.getToken("inner").strings.delimiter;
		}
	} else if ((segments.segments.start.length + segments.segments.middle.length) > 1) {
		and = state.output.getToken("inner").strings.delimiter + and;
	} else {
		if (!and) {
			and = state.output.getToken("inner").strings.delimiter;
		}
	}
	if (and.match(CSL.STARTSWITH_ROMANESQUE_REGEXP)) {
		and = " " + and;
	}
	if (and.match(CSL.ENDSWITH_ROMANESQUE_REGEXP)) {
		and = and + " ";
	}
	state.output.getToken("name").strings.delimiter = and;

	state.output.openLevel("name");
	state.output.openLevel("inner");
	segments.outputSegmentNames("start");
	segments.outputSegmentNames("middle");
	state.output.closeLevel(); // inner
	segments.outputSegmentNames("end");
	state.output.closeLevel(); // name
};

CSL.Util.Names.StartMiddleEnd = function (state, names) {
	var start, middle, endstart, end, ret;
	this.state = state;
	this.nameoffset = 0;
	//
	// what to do here?  we need config for this, tokens to
	// control the joining that will come.  how do we get
	// them into this function?
	start = names.slice(0, 1);
	middle = names.slice(1, (names.length - 1));
	endstart = 1;
	if (names.length > 1) {
		endstart = (names.length - 1);
	}
	end = names.slice(endstart, (names.length));
	ret = {};
	ret.start = start;
	ret.middle = middle;
	ret.end = end;
	this.segments = ret;
};

CSL.Util.Names.StartMiddleEnd.prototype.outputSegmentNames = function (seg) {
	var state, value, sequence, pos, len;
	state = this.state;
	len = this.segments[seg].length;
	for (pos = 0; pos < len; pos += 1) {
		this.namenum = parseInt(pos, 10);
		this.name = this.segments[seg][pos];
		if (this.name.literal) {
			value = this.name.literal;
			state.output.append(this.name.literal, "empty");
		} else {
			sequence = CSL.Util.Names.getNamepartSequence(state, seg, this.name);

			state.output.openLevel(sequence[0][0]);
			state.output.openLevel(sequence[0][1]);
			state.output.openLevel(sequence[0][2]);
			this.outputNameParts(sequence[1]);

			state.output.closeLevel();
			state.output.openLevel(sequence[0][2]);

			this.outputNameParts(sequence[2]);

			state.output.closeLevel();
			state.output.closeLevel();
			//
			// articular goes here  //
			//
			this.outputNameParts(sequence[3]);

			state.output.closeLevel();
		}
	}
	this.nameoffset += this.segments[seg].length;
};

CSL.Util.Names.StartMiddleEnd.prototype.outputNameParts = function (subsequence) {
	var state, len, pos, key, namepart, initialize_with;
	state = this.state;
	len = subsequence.length;
	for (pos = 0; pos < len; pos += 1) {
		key = subsequence[pos];
		namepart = this.name[key];
		if (("given" === key || "suffix" === key) && !this.name["static-ordering"]) {
			if (0 === state.tmp.disambig_settings.givens[state.tmp.nameset_counter][(this.namenum + this.nameoffset)]) {
				continue;
			} else if ("given" === key && 1 === state.tmp.disambig_settings.givens[state.tmp.nameset_counter][(this.namenum + this.nameoffset)]) {
				initialize_with = state.output.getToken("name").strings["initialize-with"];
				namepart = CSL.Util.Names.initializeWith(state, namepart, initialize_with);
			}
		}
		state.output.append(namepart, key);
	}
};

CSL.Util.Names.getNamepartSequence = function (state, seg, name) {
	var token, suffix_sep, romanesque, sequence;
	token = state.output.getToken("name");
	// Set the rendering order and separators of the core nameparts
	// sequence[0][0] separates elements inside each of the the two lists
	// sequence[0][1] separates the two lists
	if (name.comma_suffix) {
		suffix_sep = "commasep";
	} else {
		suffix_sep = "space";
	}
	romanesque = name.family.match(CSL.ROMANESQUE_REGEXP);
	// neither roman nor Cyrillic characters
	if (!romanesque) {
		sequence = [["empty", "empty", "empty"], ["non-dropping-particle", "family"], ["given"], []];
	} else if (name["static-ordering"]) { // entry likes sort order
		sequence = [["space", "space", "space"], ["non-dropping-particle", "family"], ["given"], []];
	} else if (state.tmp.sort_key_flag) {
		if (state.opt["demote-non-dropping-particle"] === "never") {
			sequence = [["space", "sortsep", "space"], ["non-dropping-particle", "family", "dropping-particle"], ["given"], ["suffix"]];
		} else {
			sequence = [["space", "sortsep", "space"], ["family"], ["given", "dropping-particle", "non-dropping-particle"], ["suffix"]];
		}
	} else if (token && (token.strings["name-as-sort-order"] === "all" || (token.strings["name-as-sort-order"] === "first" && seg === "start"))) {
		//
		// Discretionary sort ordering and inversions
		//
		if (state.opt["demote-non-dropping-particle"] === "always") {
			sequence = [["sortsep", "sortsep", "space"], ["family"], ["given", "dropping-particle", "non-dropping-particle"], ["suffix"]];
		} else {
			sequence = [["sortsep", "sortsep", "space"], ["non-dropping-particle", "family"], ["given", "dropping-particle"], ["suffix"]];
		}
	} else { // plain vanilla
		sequence = [[suffix_sep, "space", "space"], ["given"], ["dropping-particle", "non-dropping-particle", "family"], ["suffix"]];
	}
	return sequence;
};

//
// Apparently never used.
//
//CSL.Util.Names.deep_copy = function (nameset) {
//	var nameset2, len, pos, name2, name;
//	print("USING");
//	nameset2 = [];
//	len = nameset.length;
//	for (pos = 0; pos < len; pos += 1) {
//		name = nameset[pos];
//		name2 = {};
//		for (var i in name) {
//			name2[i] = name[i];
//		}
//		nameset2.push(name2);
//	}
//	return nameset2;
//};


/**
 * Reinitialize scratch variables used by names machinery.
 */
//
// XXXX A handy guide to variable assignments that need
// XXXX to be eliminated.  :)
//
CSL.Util.Names.reinit = function (state, Item) {
	state.tmp.value = [];
	state.tmp.name_et_al_term = false;
	state.tmp.name_et_al_decorations = false;


	state.tmp.name_et_al_form = "long";
	state.tmp.et_al_prefix = false;
};

CSL.Util.Names.getCommonTerm = function (state, namesets) {
	var base_nameset, varnames, len, pos, short_namesets, nameset;
	if (namesets.length < 2) {
		return false;
	}
	base_nameset = namesets[0];
	varnames = [];
	if (varnames.indexOf(base_nameset.variable) === -1) {
		varnames.push(base_nameset.variable);
	}
	short_namesets = namesets.slice(1);
	len = short_namesets.length;
	for (pos = 0; pos < len; pos += 1) {
		nameset = short_namesets[pos];
		if (!CSL.Util.Names.compareNamesets(base_nameset, nameset)) {
			return false;
		}
		if (varnames.indexOf(nameset.variable) === -1) {
			varnames.push(nameset.variable);
		}
	}
	varnames.sort();
	return varnames.join("");
};


CSL.Util.Names.compareNamesets = function (base_nameset, nameset) {
	var name, pos, len, part, ppos, llen;
	if (!base_nameset.names || !nameset.names || base_nameset.names.length !== nameset.names.length) {
		return false;
	}
	len = nameset.names.length;
	for (pos = 0; pos < len; pos += 1) {
		name = nameset.names[pos];
		llen = CSL.NAME_PARTS.length;
		for (ppos = 0; ppos < llen; ppos += 1) {
			part = CSL.NAME_PARTS[ppos];
			if (!base_nameset.names[pos] || base_nameset.names[pos][part] !== name[part]) {
				return false;
			}
		}
	}
	return true;
};


/**
 * Initialize a name.
 */
CSL.Util.Names.initializeWith = function (state, name, terminator) {
	var namelist, l, i, n, m, extra, ret, s, c, pos, len, ppos, llen, llst;
	if (!name) {
		return "";
	}
	namelist = name;
	if (state.opt["initialize-with-hyphen"] === false) {
		namelist = namelist.replace(/\-/g, " ");
	}
	namelist = namelist.replace(/\./g, " ").replace(/\s*\-\s*/g, "-").replace(/\s+/g, " ").split(/(\-|\s+)/);
	l = namelist.length;
	for (pos = 0; pos < l; pos += 2) {
		n = namelist[pos];
		m = n.match(CSL.NAME_INITIAL_REGEXP);
		if (m && m[1] === m[1].toUpperCase()) {
			extra = "";
			// extra upper-case characters also included
			if (m[2]) {
				s = "";
				llst = m[2].split("");
				llen = llst.length;
				for (ppos = 0; ppos < llen; ppos += 1) {
					c = llst[ppos];
					if (c === c.toUpperCase()) {
						s += c;
					} else {
						break;
					}
				}
				if (s.length < m[2].length) {
					extra = s.toLocaleLowerCase();
				}
			}
			namelist[pos] = m[1].toLocaleUpperCase() + extra;
			if (pos < (namelist.length - 1)) {
				if (namelist[(pos + 1)].indexOf("-") > -1) {
					namelist[(pos + 1)] = terminator + namelist[(pos + 1)];
				} else {
					namelist[(pos + 1)] = terminator;
				}
			} else {
				namelist.push(terminator);
			}
		} else if (n.match(CSL.ROMANESQUE_REGEXP)) {
			// romanish things that began with lower-case characters don't get initialized ...
			namelist[pos] = " " + n;
		}
	}
	ret = CSL.Util.Names.stripRight(namelist.join(""));
	ret = ret.replace(/\s*\-\s*/g, "-").replace(/\s+/g, " ");
	return ret;
};


CSL.Util.Names.stripRight = function (str) {
	var end, pos, len;
	end = 0;
	len = str.length - 1;
	for (pos = len; pos > -1; pos += -1) {
		if (str[pos] !== " ") {
			end = pos + 1;
			break;
		}
	}
	return str.slice(0, end);
};

// deleted CSL.Util.Names,rescueNameElements()
// apparently not used.
