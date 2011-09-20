// Get a domain name from the URL
function get_domain(url)
{
	if(url) return url.replace(/https?:\/\/(([\w-]+\.?)+).*/, "$1");
}

function linkurls(text)
{
	return text.replace(/(https?:\/\/[^\b\s]+)/, "<a href=\"$1\">$1</a>");
}

function link_favicon(url)
{
	return '<a href="' + url + '" class="favicon" width="16px" height="16px">' + favicon(url) + '</a>';
}

function strip_tags(str)
{
	return str.replace(/(<([^>]+)>)/ig,"");
}

// Google keeps an up-to-date copy of all important site favicons
function favicon(url)
{
	return '<img src="http://s2.googleusercontent.com/s2/favicons?domain=' + get_domain(url) + '" class="favicon" width="16" />';
}

// Compare two text segments
function same_text(one, two)
{
	//console.log('SAME TEXT = ' + one.substr(0, 30) + ' = ' + two.replace(/\W/, '').substr(0, 30));
	return (one.replace(/\W/, '').substr(0, 30) == two.replace(/\W/, '').substr(0, 30));
}

function getURLParameter(name, url)
{
    return decodeURI(
        (RegExp(name + '=' + '(.+?)(&|$)').exec((url||location.search))||[,null])[1]
        //(RegExp('[?|&]' + name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] // Better?
    );
}

function parseQuery(a,b,c,d,e)
{
	a=a.replace(/.+?(\?.+)/, '$1');
	for(b=/[?&]?([^=]+)=([^&]*)/g,c={},e=decodeURIComponent;d=b.exec(a.replace(/\+/g,' '));c[e(d[1])]=e(d[2]));return c;
}

function show(name)
{
	$('#content .c').hide(0, function() {
		$('#spinner').empty();
		$("#"+name).show();
	});
}

function cache(key, value)
{
	if( ! window.localStorage) return;

	if(value)
	{
		return localStorage.setItem(key, JSON.stringify({ value : value, timestamp : new Date().getTime() }));
	}

	// If the item exists, and is not too old..
	if(localStorage.getItem(key))
	{
		var value = JSON.parse(localStorage.getItem(key));

		// If the item is still valid
		if(config.cache_life > (new Date().getTime() - value.timestamp))
		{
			//console.log('item is still valid');
			return value.value;
		}
	}
};

window.onpopstate = function(e)
{
	// If no previous state object
	if( ! e.state) return;

	// FF & Chrome fire this on load
	if(window.location.pathname == state.path) return;

	state = e.state;

	route(state.path);
};

var load = {

	script : function(url)
	{
		var script = document.createElement("script");
		script.src = url;
		script.type = 'text/javascript';
		document.body.appendChild(script);

		// Remove 30 seconds later
		setTimeout(function(){document.body.removeChild(s)}, 30000);
	},

	pipe : function(url, callback)
	{
		var data = cache(url);

		if(data) return callback(url, data);

		$.getJSON(url, function(data,textStatus)
		{
			cache(url, data);
			callback(url, data, textStatus);
		});
	},

	spinner : function(a)
	{
		function b(){a.innerHTML="◒◐◓◑".charAt(b=-~b%4)};
		setInterval(b,250/(a||1));
		b(a=document.createElement("b"));
		return a
	},

	contact : function()
	{
		// Load the map
		if( ! gmaps.loaded)
		{
			google.load("maps", "3", {callback: gmaps.init, other_params:"sensor=false"});
		}

		show('contact');
	}
};


var gmaps = {

	current_lat_lon : {},
	zoom : 3,
	directionsDisplay : null,
	directionsService : null,
	map : null,
	geocoder : null,
	loaded : false,

	init : function()
	{
		//console.log('Loading map');
		gmaps.loaded = true;

		// Full Country Zoom
		gmaps.zoom = 3;

		// Default to the USA view
		gmaps.current_lat_lon = new google.maps.LatLng(38.95940879245423, -100.283203125);

		// Create map
		gmaps.map = new google.maps.Map(document.getElementById("map"), {
			zoom: gmaps.zoom,
			center: gmaps.current_lat_lon,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		gmaps.geocoder = new google.maps.Geocoder();

		gmaps.directionsService = new google.maps.DirectionsService();

		gmaps.directionsDisplay = new google.maps.DirectionsRenderer({
			'map': gmaps.map,
			'preserveViewport': true,
			'draggable': true
		});

		gmaps.directionsDisplay.setPanel(document.getElementById("map_directions"));

		gmaps.calcRoute();
	},

	calcRoute : function()
	{
		var end = gmaps.getFormattedLocation();

		// Unknown GEOIP, so just show a marker at my place!
		if( ! end)
		{
			gmaps.geocoder.geocode( { 'address': config.address}, function(results, status)
			{
				if (status == google.maps.GeocoderStatus.OK)
				{
					gmaps.map.setCenter(results[0].geometry.location);
					var marker = new google.maps.Marker({
						map: gmaps.map,
						position: results[0].geometry.location,
						title: config.address
					});
				} else {
					alert("We have no idea where you are because: " + status);
				}
			});
			return;
		}

		var request = {
			origin: end,
			destination: config.address,
			travelMode: google.maps.DirectionsTravelMode.DRIVING
		};

		gmaps.directionsService.route(request, function(response, status)
		{
			if (status == google.maps.DirectionsStatus.OK)
			{
				gmaps.directionsDisplay.setDirections(response);

				// Center map now
				if(response.routes && response.routes.length)
				{
					gmaps.map.fitBounds(response.routes[0].bounds);
				}
			}
		});
	},

	getFormattedLocation : function()
	{
		if( ! google.loader.ClientLocation) return;

		if (google.loader.ClientLocation.address.country_code == "US" &&
			google.loader.ClientLocation.address.region) {
			return google.loader.ClientLocation.address.city + ", "
				+ google.loader.ClientLocation.address.region.toUpperCase();
		} else {
			return google.loader.ClientLocation.address.city + ", "
					+ google.loader.ClientLocation.address.country_code;
		}
	},

	// If ClientLocation was filled in by the loader, use that info instead
	center_by_ip : function()
	{
		if (google.loader.ClientLocation)
		{
			current_lat_lon = new google.maps.LatLng(google.loader.ClientLocation.latitude, google.loader.ClientLocation.longitude);
			map.setCenter(current_lat_lon);
			map.setZoom(12);
			return true;
		}
	},

	// Ask the user
	center_by_browser : function()
	{
		if(navigator.geolocation)
		{
			browserSupportFlag = true;
			navigator.geolocation.getCurrentPosition(function(position)
			{
				current_lat_lon = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
				map.setCenter(current_lat_lon);
				map.setZoom(12);
				return true;
			}, function() { /* On failure */ });
		}
	}


};



function pipe_callback(url, data, textStatus)
{
	// Remove feed content
	$('#feed').empty();

	// Is a page given?
	var page = parseInt((state.params && state.params.page) ? state.params.page : 1);

	var offset = (page - 1) * config.per_page;

	var items = data.value.items.slice(offset, page * config.per_page);

	// Nothing found?
	if( ! items)
	{
		show('404');
		return;
	}

	//data.value.items
	$.each(items, function(i,item)
	{
		var domain = (item.link || item.guid.content);
		domain = get_domain(domain).replace(/\W/, '').replace('.', '');

		// Allow custom display based on domain
		(create[domain] || create.default_handler)(i, item);
	});

	// Create pagination
	$('#feed').append('<div class="pagination"></div>');

	// More Items?
	if(data.value.items.length > (page * config.per_page))
	{
		$('.pagination').append('<a href="' + state.path + '?page=' + (page + 1) + '" class="previous">Previous</a>');
	}

	// Back towards home
	if(page > 1)
	{
		$('.pagination').append('<a href="' + state.path + '?page=' + (page - 1) + '" class="next">Next</a>');
	}

	show('feed');
}


var create = {

	twittercom : function(id, item)
	{
		var div = document.createElement('div');
		div.className = "twitter";

		// Remove starting username
		var text = item.description.substr(item.description.indexOf(': ') + 2);

		// Auto-link URL's
		text = linkurls(text);

		// Auto-link other users
		text = text.replace(/(@(\w+))/, "<a href=\"http://twitter.com/$2\">$1</a>");

		var p = document.createElement('blockquote');
		p.innerHTML = link_favicon(item.link) + ' <span>' + text + '</span>';
		div.appendChild(p);

		create.insert(id, div);
	},

	githubcom : function(id, item)
	{
		var div = document.createElement('div');
		div.className = "github";

		// Remove starting username and replace with "I"
		var text = 'I ' + item.title.substr(item.title.indexOf(' ') + 1);

		// Auto-link projects
		text = text.replace(/([^\s]+\/[^\s]+)/, "<a href=\"http://github.com/$1\">$1</a>");

		var p = document.createElement('p');
		p.className = 'title';
		p.innerHTML = link_favicon(item.link) + ' <span>' + text + '</span>';
		div.appendChild(p);

		// Get project description
		var description = item.description.match(/<blockquote( title="([^>]*)")?>((\s|.)+?)<\/blockquote>/);

		if(description)
		{
			description = (description[2] || description[3]);
		}

		var p = document.createElement('p');
		p.className = 'description';
		p.innerHTML = description;
		div.appendChild(p);

		create.insert(id, div);
	},

	gistgithubcom : function(id, item)
	{
		var div = document.createElement('div');
		div.className = "github";

		// Remove starting username and replace with "I"
		var title = 'I ' + item.title.substr(item.title.indexOf(' ') + 1);

		var p = document.createElement('p');
		p.className = 'title';
		p.innerHTML = '<a href="' + item.link + '">' + favicon(item.link) + ' ' + title + '</a>';
		div.appendChild(p);

		var p = document.createElement('p');
		p.className = 'description';
		p.innerHTML = strip_tags(item.description);
		div.appendChild(p);

		create.insert(id, div);
	},

	xeoncrosscom : function(id, item)
	{
		var div = document.createElement('div');
		div.className = "tumblr";

		// Is this a quote (or video?)
		if( ! same_text(item.description, item.title))
		{
			var h2 = document.createElement('h2');
			h2.innerHTML = link_favicon(item.link) + ' ' + item.title;
			div.appendChild(h2);

			var p = document.createElement('p');
			p.innerHTML = item.description;
			div.appendChild(p);
		}
		else
		{
			var div2 = document.createElement('blockquote');
			div2.innerHTML = item.description;
			div.appendChild(div2);
		}

		create.insert(id, div);
	},

	wwwlastfm : function(id, item)
	{
		var div = document.createElement('div');
		div.className = "item";

		var h2 = document.createElement('h2');
		h2.innerHTML = '<a href="' + item.guid.content + '">' + favicon(item.guid.content) + ' ' + item.title + '</a>';
		div.appendChild(h2);

		// Probably won't work since it's an MP3 most of the time...
		var audio = new Audio(item.enclosure.url);
		audio.duration = item.enclosure.duration;

		div.appendChild(audio);

		create.insert(id, div);
	},

	default_handler : function(id, item)
	{
		var div = document.createElement('div');
		div.className = "item";

		var h2 = document.createElement('h2');
		h2.innerHTML = '<a href="' + item.link + '">' + favicon(item.link) + ' ' + item.title + '</a>';
		div.appendChild(h2);

		if(item.description)
		{
			// IE 6-8 needs a <div> not a <p>
			var div2 = document.createElement('div');
			div2.innerHTML = item.description;
			div.appendChild(div2);
		}

		create.insert(id, div);
	},

	insert : function(id, div)
	{
		// Keep the insert fast
		document.getElementById('feed').appendChild(div);
	}
};
