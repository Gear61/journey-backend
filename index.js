var express = require('express');
var app = express();
var FB = require('fb');

// PostgreSQL client
const { Client } = require('pg');

// Oauth client for Google login
const {OAuth2Client} = require('google-auth-library');
const GOOGLE_CLIENT_ID = "956612316816-n23cs49obd4fmn1qgs4abhqs7t3f6fnd.apps.googleusercontent.com";
const google_oauth_client = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST body parsing
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.get('/db', function (request, response) {
	client.connect();
	client.query('SELECT NOW()', (err, res) => {
  		response.send(res.rows[0]);
  		client.end();
	})
});

function getDatabaseClient() {
	return new Client({
		user: 'bwptlpjywkcdqm',
		password: '1323ec466a526b06a703766154b185c631a0f3bebf705c1a9e361153b673ca0b',
		host: 'ec2-184-72-228-128.compute-1.amazonaws.com',
		database: 'd31ledcluma0ap',
		port: 5432,
		ssl: true,
	});
}

app.post('/onboarding/facebook', function(request, response) {
	var access_token = request.body.access_token;

	FB.setAccessToken(access_token);
    FB.api('me', { fields: ['name', 'email', 'picture.type(large)'] }, function (user_info) {
	  	if(!user_info || user_info.error) {
	    	response.status(400);
		    response.send({'error': user_info.error});
			return;
		}

		var name = user_info.name;
		var email = user_info.email;
		var profile_picture_url = user_info.picture.data.url;

		const account_query = 'SELECT * FROM Account WHERE email = $1';
		const values = [email];

		const client = getDatabaseClient();
		client.connect();
		client.query(account_query, values)
			.then(res => {
				client.end();

				// Account doesn't exist yet; create it and return
				if (res.rows.length == 0) {
					console.log("Account doesn't exist for email: " + email);
					var login_type = 'FACEBOOK';
					createAccount(name, email, profile_picture_url, login_type, response);
				} else {
					if (res.rows[0].login_type === 'FACEBOOK') {
						console.log("Account already exists for email: " + email);
						response.send(res.rows[0]);
					} else {
						console.log("Non-Facebook account already exists for email: " + email);
						response.status(401);
						var error = {'error': 'email_in_use'};
						response.send(error);
					}
				}
			})
			.catch(e => {
				console.error(e.stack)
				response.status(500);
				var error = {'error': 'internal_server_error'};
				response.send(error);
			});
	});
});

async function createAccount(name, email, profile_picture_url, login_type, response) {
	const insert_query = 'INSERT INTO Account(name, email, profile_picture_url, login_type) ' +
						 'VALUES($1, $2, $3, $4) RETURNING *'
	const values = [name, email, profile_picture_url, login_type];

	const client = getDatabaseClient();
	client.connect();
	client.query(insert_query, values)
		.then(res => {
			console.log(res.rows[0])
			response.status(200);
			response.send(res.rows[0]);
		})
		.catch(e => {
			console.error(e.stack)
			response.status(500);
			var error = {'error': 'internal_server_error'};
			response.send(error);
		});
}

app.post('/onboarding/google', function(request, response) {
	var id_token = request.body.id_token;
	verifyGoogleToken(id_token, response).catch(console.error);
});

async function verifyGoogleToken(token, response) {
  	const ticket = await google_oauth_client.verifyIdToken({
		idToken: token,
		audience: GOOGLE_CLIENT_ID,
	});
	const payload = ticket.getPayload();

	response.status(200);
	var user_info = {};
	user_info['name'] = payload['name'];
	user_info['email'] = payload['email'];
	user_info['profile_picture_url'] = payload['picture'];
	response.send(user_info);
}

app.listen(app.get('port'), function() {
  	console.log('Node app is running on port', app.get('port'));
});
