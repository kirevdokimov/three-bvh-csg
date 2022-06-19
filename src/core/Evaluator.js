import { BufferGeometry, BufferAttribute } from 'three';
import { TriangleSplitter } from './TriangleSplitter.js';
import { TypedAttributeData } from './TypedAttributeData.js';
import { OperationDebugData } from './OperationDebugData.js';
import { performOperation } from './operations.js';
import { setDebugContext } from './operationsUtils.js';
import { Brush } from './Brush.js';

// applies the given set of attribute data to the provided geometry. If the attributes are
// not large enough to hold the new set of data then new attributes will be created. Otherwise
// the existing attributes will be used and draw range updated to accommodate the new size.
function applyToGeometry( geometry, referenceGeometry, attributeData ) {

	let needsDisposal = false;
	let drawRange = - 1;

	// set the data
	const attributes = geometry.attributes;
	for ( const key in attributeData ) {

		const { array, type, length } = attributeData[ key ];
		const trimmedArray = new type( array.buffer, 0, length );

		let attr = attributes[ key ];
		if ( ! attr || attr.array.length < length ) {

			// create the attribute if it doesn't exist yet
			const refAttr = referenceGeometry.attributes[ key ];
			attr = new BufferAttribute( trimmedArray.slice(), refAttr.itemSize, refAttr.normalized );
			geometry.setAttribute( key, attr );
			needsDisposal = true;

		} else {

			// set the new array data
			attr.array.set( trimmedArray, 0 );
			attr.needsUpdate = true;

		}

		drawRange = length / attr.itemSize;


	}

	// update the draw range
	geometry.setDrawRange( 0, drawRange );

	// remove or update the index appropriately
	if ( geometry.index ) {

		const indexArray = geometry.index.array;
		if ( indexArray.length < drawRange ) {

			geometry.index = null;
			needsDisposal = true;

		} else {

			for ( let i = 0, l = indexArray.length; i < l; i ++ ) {

				indexArray[ i ] = i;

			}

		}

	}

	// remove the bounds tree if it exists because its now out of date
	// TODO: can we have this dispose in the same way that a brush does?
	geometry.boundsTree = null;

	if ( needsDisposal ) {

		geometry.dispose();

	}

	return geometry;

}

// Utility class for performing CSG operations
export class Evaluator {

	constructor() {

		this.triangleSplitter = new TriangleSplitter();
		this.attributeData = new TypedAttributeData();
		this.attributes = [ 'position', 'uv', 'normal' ];
		this.useGroups = true;
		this.debug = new OperationDebugData();

	}

	evaluate( a, b, operation, targetBrush = new Brush() ) {

		a.prepareGeometry();
		b.prepareGeometry();

		const { triangleSplitter, attributeData, attributes, debug } = this;
		const targetGeometry = targetBrush.geometry;
		const aAttributes = a.geometry.attributes;
		for ( let i = 0, l = attributes.length; i < l; i ++ ) {

			const key = attributes[ i ];
			const attr = aAttributes[ key ];
			attributeData.initializeArray( key, attr.array.constructor );

		}

		for ( const key in attributeData.attributes ) {

			if ( ! attributes.includes( key ) ) {

				attributeData.delete( key );

			}

		}

		for ( const key in targetGeometry.attributes ) {

			if ( ! attributes.includes( key ) ) {

				targetGeometry.deleteAttribute( key );
				targetGeometry.dispose();

			}

		}

		attributeData.clear();

		if ( debug.enabled ) {

			debug.reset();
			setDebugContext( debug );

		}

		const { groups, materials } = performOperation( a, b, operation, triangleSplitter, attributeData, { useGroups: this.useGroups } );

		if ( debug.enabled ) {

			setDebugContext( null );

		}

		applyToGeometry( targetGeometry, a.geometry, attributeData.attributes );

		targetBrush.material = materials || targetBrush.material;
		targetGeometry.clearGroups();
		for ( let i = 0, l = groups.length; i < l; i ++ ) {

			const group = groups[ i ];
			targetGeometry.addGroup( group.start, group.count, group.materialIndex );

		}

		return targetBrush;

	}

	evaluateHierarchy( root ) {

		// TODO

	}

	reset() {

		this.triangleSplitter.reset();

	}

}
