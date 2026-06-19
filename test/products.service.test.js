const test = require('node:test');
const assert = require('node:assert/strict');
const ProductsService = require('../src/services/products.service');
const ScrapedProduct = require('../src/models/products.model');

const originalFindOneAndUpdate = ScrapedProduct.findOneAndUpdate;

test.afterEach(() => {
    ScrapedProduct.findOneAndUpdate = originalFindOneAndUpdate;
});

function stubFindOneAndUpdate(assertCall) {
    ScrapedProduct.findOneAndUpdate = (filter, update, options) => {
        assertCall(filter, update, options);

        return {
            lean: async () => ({
                product_id: filter.product_id,
                display_name: 'Producto test',
                image_url: update.$set.image_url,
            }),
        };
    };
}

test('updateProduct persists image_url and returns updated product', async () => {
    stubFindOneAndUpdate((filter, update, options) => {
        assert.deepEqual(filter, { product_id: 'PROD-1' });
        assert.equal(update.$set.image_url, 'https://example.com/test-image.jpg');
        assert.equal(Object.hasOwn(update.$set, 'imageUrl'), false);
        assert.deepEqual(options, { new: true, runValidators: true });
    });

    const product = await ProductsService.updateProduct('PROD-1', {
        image_url: ' https://example.com/test-image.jpg ',
    });

    assert.equal(product.image_url, 'https://example.com/test-image.jpg');
});

test('updateProduct accepts imageUrl as input alias for image_url', async () => {
    stubFindOneAndUpdate((_filter, update) => {
        assert.equal(update.$set.image_url, 'https://example.com/test-image-camel.jpg');
        assert.equal(Object.hasOwn(update.$set, 'imageUrl'), false);
    });

    const product = await ProductsService.updateProduct('PROD-2', {
        imageUrl: 'https://example.com/test-image-camel.jpg',
    });

    assert.equal(product.image_url, 'https://example.com/test-image-camel.jpg');
});

test('updateProduct rejects invalid image_url values', async () => {
    ScrapedProduct.findOneAndUpdate = () => {
        throw new Error('findOneAndUpdate should not be called');
    };

    await assert.rejects(
        () => ProductsService.updateProduct('PROD-3', { image_url: 'not-a-url' }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /image_url/);
            return true;
        }
    );
});

test('updateProduct rejects conflicting image_url and imageUrl values', async () => {
    ScrapedProduct.findOneAndUpdate = () => {
        throw new Error('findOneAndUpdate should not be called');
    };

    await assert.rejects(
        () => ProductsService.updateProduct('PROD-4', {
            image_url: 'https://example.com/a.jpg',
            imageUrl: 'https://example.com/b.jpg',
        }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.match(error.message, /image_url o imageUrl/);
            return true;
        }
    );
});
