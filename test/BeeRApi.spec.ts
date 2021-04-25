import BeerApi   from '../src/BeeRApi';

const chai     = require( 'chai' );
const chaiHttp = require( 'chai-http' );

chai.use( chaiHttp );

describe('Api Tests', function() {
  let api: BeerApi;

  it( 'should create the api instance', () => {
    api = BeerApi.genInstance( "beer.db", 9000, "test.log" );
  } ); 

  it( 'should add four hive Data', async () => {
    const now   = new Date();
    let nowp1 = new Date();
    nowp1.setMinutes( now.getMinutes() + 1 );

    await api.addHiveData( {
      client_id: "abcd",
      date: now.toString(),
      metrics: []
    } );
    await api.addHiveData( {
      client_id: "efgh",
      date: now.toString(),
      metrics: []
    } );
    await api.addHiveData( {
      client_id: "abcd",
      date: nowp1.toString(),
      metrics: []
    } );
    await api.addHiveData( {
      client_id: "efgh",
      date: nowp1.toString(),
      metrics: []
    } );
  } ); 

  it( 'should throw an error beacause hive data is not valid', async () => {

    try{
      await api.addHiveData( {} );
      chai.assert( false, 'Should throw an error' );
    }catch( error ){}
  
  } ); 

  it( 'should query the db returning only the results with "abcd" as client_id', async () => {
    const result = await api.getHiveData( "abcd" );
    chai.expect( result.length ).is.eq( 2 );
    chai.expect( result[0].client_id ).is.eq( "abcd" );
    chai.expect( result[1].client_id ).is.eq( "abcd" );
    chai.assert( Date.parse( result[0].date ) > Date.parse( result[1].date ) );
  } );

  it( 'should get abcd data from /query api', () => {
    chai.request( api.getApp() )
        .get( '/query?hive=abcd' )
        .end( ( err, res ) => {
              res.should.have.status(200);
              res.body.should.be.a( 'array' );
              res.body.length.should.be.eql( 2 );

              chai.expect( res.body[0].client_id ).is.eq( "abcd" );
              chai.expect( res.body[1].client_id ).is.eq( "abcd" );
              chai.assert( Date.parse( res.body[0].date ) > Date.parse( res.body[1].date ) );
        } );
  } );

  it( 'should get abcd and efgh hive data from /query api', () => {
    chai.request( api.getApp() )
        .get( '/query?hive=abcd&hive=efgh' )
        .end( ( err, res ) => {
              res.should.have.status(200);
              res.body.should.be.a( 'object' );

              chai.expect( res.body[ 'abcd' ] ).should.be.a( 'array' );
              chai.expect( res.body[ 'abcd' ].length ).is.eq( 2 );

              chai.expect( res.body[ 'efgh' ] ).should.be.a( 'array' );
              chai.expect( res.body[ 'efgh' ].length ).is.eq( 2 );

              chai.expect( res.body[ 'abcd' ][ 0 ].client_id ).is.eq( "abcd" );
              chai.expect( res.body[ 'abcd' ][ 1 ].client_id ).is.eq( "abcd" );

              chai.expect( res.body[ 'efgh' ][ 0 ].client_id ).is.eq( "efgh" );
              chai.expect( res.body[ 'efgh' ][ 1 ].client_id ).is.eq( "efgh" );
              
              chai.assert( Date.parse( res.body[ 'abcd' ][0].date ) > Date.parse( res.body[ 'abcd' ][1].date ) );
              chai.assert( Date.parse( res.body[ 'efgh' ][0].date ) > Date.parse( res.body[ 'efgh' ][1].date ) );
        } );
  } );

  it( 'should get 400 requesting /query without hives', () => {
    chai.request( api.getApp() )
        .get( '/query?' )
        .end( ( err, res ) => {
              res.should.have.status(400);
        } );
  } );
} );
