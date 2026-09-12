class_name PuzzlePieceV3
extends Node2D

signal locked_in_place(piece)

var target_position: Vector2 = Vector2.ZERO
var snap_distance: float = 42.0
var piece_id: int = -1
var locked: bool = false

var _polygon: PackedVector2Array
var _uv: PackedVector2Array
var _bounds: Rect2
var _texture: Texture2D
var _display_scale: float = 1.0
var _drag_offset: Vector2 = Vector2.ZERO
var _lifted: bool = false
var _detail_level: int = 0
var _base_z_index: int = 10


func setup(
	texture: Texture2D,
	polygon_points: PackedVector2Array,
	uv_points: PackedVector2Array,
	target: Vector2,
	display_scale: float,
	id: int,
	snap_distance_px: float,
	detail_level: int = 0
) -> void:
	_texture = texture
	_polygon = polygon_points
	_uv = PackedVector2Array()
	target_position = target
	_display_scale = display_scale
	piece_id = id
	snap_distance = snap_distance_px
	_detail_level = detail_level
	z_index = _base_z_index
	scale = Vector2.ONE * display_scale

	# CanvasItem polygon drawing expects normalized UV coordinates.
	# The generator works in source-image pixels, so normalize once here.
	var texture_size: Vector2 = _texture.get_size()
	if texture_size.x > 0.0 and texture_size.y > 0.0:
		for uv in uv_points:
			_uv.append(Vector2(
				uv.x / texture_size.x,
				uv.y / texture_size.y
			))
	else:
		_uv = uv_points

	_bounds = _calculate_bounds(_polygon)
	queue_redraw()


func place_scrambled(at_position: Vector2) -> void:
	locked = false
	_lifted = false
	position = at_position
	z_index = _base_z_index
	queue_redraw()


func contains_world_point(world_point: Vector2) -> bool:
	if locked or _polygon.is_empty():
		return false
	var local_point: Vector2 = to_local(world_point)
	if not _bounds.has_point(local_point):
		return false
	return Geometry2D.is_point_in_polygon(local_point, _polygon)


func begin_drag(world_point: Vector2) -> void:
	if locked:
		return
	_drag_offset = position - world_point
	_lifted = true
	z_index = 10000
	queue_redraw()


func drag_to(world_point: Vector2) -> void:
	if locked:
		return
	position = world_point + _drag_offset


func end_drag() -> bool:
	if locked:
		return false

	_lifted = false
	z_index = _base_z_index
	if position.distance_to(target_position) <= snap_distance:
		position = target_position
		locked = true
		queue_redraw()
		locked_in_place.emit(self)
		return true

	queue_redraw()
	return false


func _draw() -> void:
	if _polygon.is_empty() or _texture == null:
		return

	# No visible stroke around the piece. Real jigsaw pieces are separated by
	# the image boundary and a soft cast shadow, not by a technical outline.
	var shadow_alpha: float = 0.035 if locked else (0.20 if _lifted else 0.10)
	var shadow_screen_offset: Vector2 = (
		Vector2(1.0, 1.2) if locked
		else (Vector2(10.0, 12.0) if _lifted else Vector2(3.5, 4.5))
	)
	var shadow_local_offset: Vector2 = shadow_screen_offset / maxf(_display_scale, 0.001)
	var shadow_points := PackedVector2Array()
	shadow_points.resize(_polygon.size())
	for index in range(_polygon.size()):
		shadow_points[index] = _polygon[index] + shadow_local_offset

	draw_colored_polygon(shadow_points, Color(0.0, 0.0, 0.0, shadow_alpha))
	draw_colored_polygon(_polygon, Color.WHITE, _uv, _texture)


func _calculate_bounds(points: PackedVector2Array) -> Rect2:
	if points.is_empty():
		return Rect2()

	var min_point: Vector2 = points[0]
	var max_point: Vector2 = points[0]
	for point in points:
		min_point.x = minf(min_point.x, point.x)
		min_point.y = minf(min_point.y, point.y)
		max_point.x = maxf(max_point.x, point.x)
		max_point.y = maxf(max_point.y, point.y)
	return Rect2(min_point, max_point - min_point)
